import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabase";
import type { Role } from "./data";

type ListonePlayer = {
  fantacalcio_id: number;
  name: string;
  role: Role;
  club: string;
  quotation: number | null;
};

type ExistingPlayer = {
  id: number;
  name: string;
  role: Role;
  club: string;
  quotation: number | null;
  fantacalcio_id: number | null;
};

type PurchaseRow = {
  player_id: number;
};

type Props = {
  onImportComplete: () => Promise<void>;
};

function normalizeName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function ListoneImport({
  onImportComplete,
}: Props) {
  const [fileName, setFileName] =
    useState("");

  const [players, setPlayers] =
    useState<ListonePlayer[]>([]);

  const [error, setError] =
    useState("");

  const [isImporting, setIsImporting] =
    useState(false);

  const [importResult, setImportResult] =
    useState("");

  async function readFile(
    file: File,
  ) {
    setError("");
    setImportResult("");
    setPlayers([]);
    setFileName(file.name);

    try {
      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(buffer, {
          type: "array",
        });

      if (
        !workbook.SheetNames.includes(
          "Tutti",
        )
      ) {
        setError(
          'Il file non contiene il foglio "Tutti".',
        );
        return;
      }

      const worksheet =
        workbook.Sheets["Tutti"];

      /*
       * Nel Listone ufficiale:
       *
       * riga 1 = titolo
       * riga 2 = intestazioni reali
       *
       * Quindi range: 1 significa:
       * parti dalla seconda riga.
       */
      const rows =
        XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(worksheet, {
          range: 1,
          defval: null,
        });

      const parsedPlayers:
        ListonePlayer[] = [];

      for (const row of rows) {
        const id =
          Number(row["Id"]);

        const role =
          String(
            row["R"] ?? "",
          ).trim() as Role;

        const name =
          String(
            row["Nome"] ?? "",
          ).trim();

        const club =
          String(
            row["Squadra"] ?? "",
          ).trim();

        const rawQuotation =
          row["Qt.A"];

        const quotation =
          rawQuotation === null ||
          rawQuotation === undefined ||
          rawQuotation === ""
            ? null
            : Number(
                rawQuotation,
              );

        if (
          !Number.isFinite(id) ||
          !name ||
          !club ||
          !["P", "D", "C", "A"].includes(
            role,
          )
        ) {
          continue;
        }

        parsedPlayers.push({
          fantacalcio_id: id,
          name,
          role,
          club,
          quotation:
            quotation !== null &&
            Number.isFinite(
              quotation,
            )
              ? quotation
              : null,
        });
      }

      if (
        parsedPlayers.length === 0
      ) {
        setError(
          "Non ho trovato giocatori validi nel foglio Tutti.",
        );
        return;
      }

      setPlayers(
        parsedPlayers,
      );
    } catch (caughtError) {
      console.error(
        "Errore lettura Listone:",
        caughtError,
      );

      setError(
        "Impossibile leggere il file Excel.",
      );
    }
  }

  async function importListone() {
    if (
      players.length === 0 ||
      isImporting
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Vuoi aggiornare il Listone con ${players.length} giocatori?\n\nGli acquisti già registrati verranno preservati.`,
      );

    if (!confirmed) {
      return;
    }

    setIsImporting(true);
    setError("");
    setImportResult("");

    try {
      /*
       * 1. Leggiamo giocatori e acquisti
       * già presenti.
       */
      const [
        existingPlayersResult,
        purchasesResult,
      ] = await Promise.all([
        supabase
          .from("players")
          .select(
            "id, name, role, club, quotation, fantacalcio_id",
          ),

        supabase
          .from("purchases")
          .select("player_id"),
      ]);

      if (
        existingPlayersResult.error
      ) {
        throw new Error(
          existingPlayersResult.error.message,
        );
      }

      if (
        purchasesResult.error
      ) {
        throw new Error(
          purchasesResult.error.message,
        );
      }

      const existingPlayers =
        (existingPlayersResult.data ??
          []) as ExistingPlayer[];

      const purchases =
        (purchasesResult.data ??
          []) as PurchaseRow[];

      const purchasedPlayerIds =
        new Set(
          purchases.map(
            (purchase) =>
              purchase.player_id,
          ),
        );

      /*
       * 2. Prima riconosciamo eventuali
       * giocatori vecchi senza
       * fantacalcio_id.
       *
       * Questo è fondamentale soprattutto
       * per eventuali giocatori già
       * acquistati: manteniamo il loro ID
       * Supabase, quindi purchases continua
       * a puntare allo stesso giocatore.
       */
      const officialByName =
        new Map<
          string,
          ListonePlayer
        >();

      for (const player of players) {
        officialByName.set(
          normalizeName(
            player.name,
          ),
          player,
        );
      }

      let matchedLegacy = 0;

      for (
        const existing of
        existingPlayers
      ) {
        if (
          existing.fantacalcio_id !==
          null
        ) {
          continue;
        }

        const official =
          officialByName.get(
            normalizeName(
              existing.name,
            ),
          );

        if (!official) {
          continue;
        }

        const { error:
          matchError } =
          await supabase
            .from("players")
            .update({
              fantacalcio_id:
                official.fantacalcio_id,

              name:
                official.name,

              role:
                official.role,

              club:
                official.club,

              quotation:
                official.quotation,
            })
            .eq(
              "id",
              existing.id,
            );

        if (matchError) {
          throw new Error(
            `Errore aggiornando ${existing.name}: ${matchError.message}`,
          );
        }

        matchedLegacy += 1;
      }

      /*
       * 3. Eliminiamo SOLO i vecchi
       * giocatori di prova:
       *
       * - senza fantacalcio_id
       * - non acquistati
       *
       * Un giocatore già acquistato non
       * viene mai cancellato.
       */
      const legacyToDelete =
        existingPlayers.filter(
          (player) =>
            player.fantacalcio_id ===
              null &&
            !purchasedPlayerIds.has(
              player.id,
            ) &&
            !officialByName.has(
              normalizeName(
                player.name,
              ),
            ),
        );

      if (
        legacyToDelete.length > 0
      ) {
        const legacyIds =
          legacyToDelete.map(
            (player) =>
              player.id,
          );

        const { error:
          deleteError } =
          await supabase
            .from("players")
            .delete()
            .in(
              "id",
              legacyIds,
            );

        if (deleteError) {
          throw new Error(
            deleteError.message,
          );
        }
      }

      /*
       * 4. Import vero e proprio.
       *
       * fantacalcio_id è UNIQUE,
       * quindi:
       *
       * - se esiste -> UPDATE
       * - se non esiste -> INSERT
       *
       * Nessun doppione.
       */
      const chunkSize = 100;

      for (
        let index = 0;
        index < players.length;
        index += chunkSize
      ) {
        const chunk =
          players.slice(
            index,
            index +
              chunkSize,
          );

        const { error:
          upsertError } =
          await supabase
            .from("players")
            .upsert(
              chunk,
              {
                onConflict:
                  "fantacalcio_id",
              },
            );

        if (upsertError) {
          throw new Error(
            upsertError.message,
          );
        }
      }

      await onImportComplete();

      setImportResult(
        `Listone aggiornato: ${players.length} giocatori. ${matchedLegacy} giocatori esistenti riconosciuti. ${legacyToDelete.length} vecchi record rimossi.`,
      );
    } catch (caughtError) {
      console.error(
        "Errore importazione Listone:",
        caughtError,
      );

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Errore durante l'importazione.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section
      style={{
        marginTop: "24px",
        paddingTop: "20px",
        borderTop:
          "1px solid rgba(255,255,255,.12)",
      }}
    >
      <p className="eyebrow">
        Gestione Listone
      </p>

      <h3>
        Importa Listone
      </h3>

      <p
        style={{
          opacity: 0.7,
          lineHeight: 1.5,
        }}
      >
        Carica il file Excel
        ufficiale di Fantacalcio.
        FantAsta utilizzerà solo il
        foglio <strong>Tutti</strong>.
        Il foglio{" "}
        <strong>Ceduti</strong> viene
        ignorato.
      </p>

      <label>
        File Excel

        <input
          type="file"
          accept=".xlsx,.xls"
          disabled={isImporting}
          onChange={(event) => {
            const file =
              event.target
                .files?.[0];

            if (file) {
              void readFile(file);
            }
          }}
        />
      </label>

      {fileName && (
        <div
          className="admin-summary"
          style={{
            marginTop: "12px",
          }}
        >
          <div>
            <span>
              File
            </span>

            <strong>
              {fileName}
            </strong>
          </div>

          <div>
            <span>
              Foglio
            </span>

            <strong>
              Tutti
            </strong>
          </div>

          <div>
            <span>
              Giocatori
            </span>

            <strong>
              {players.length}
            </strong>
          </div>

          <div>
            <span>
              Ruoli
            </span>

            <strong>
              Classic
            </strong>
          </div>

          <div>
            <span>
              Quotazione
            </span>

            <strong>
              Qt.A
            </strong>
          </div>

          <div>
            <span>
              Ceduti
            </span>

            <strong>
              Ignorati
            </strong>
          </div>
        </div>
      )}

      {error && (
        <p
          style={{
            marginTop: "12px",
            color: "#ff7676",
          }}
        >
          {error}
        </p>
      )}

      {importResult && (
        <p
          style={{
            marginTop: "12px",
          }}
        >
          {importResult}
        </p>
      )}

      <button
        type="button"
        className="assign-button"
        style={{
          marginTop: "14px",
        }}
        disabled={
          players.length === 0 ||
          isImporting
        }
        onClick={() =>
          void importListone()
        }
      >
        {isImporting
          ? "Aggiornamento in corso..."
          : "Aggiorna Listone"}
      </button>
    </section>
  );
}

export default ListoneImport;