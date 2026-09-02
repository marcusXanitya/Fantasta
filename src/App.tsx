import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./App.css";

import {
  roleLimits,
  type Player,
  type Role,
  type Team,
} from "./data";

import { supabase } from "./supabase";
import ListoneImport from "./ListoneImport";

const roles: Role[] = ["P", "D", "C", "A"];

type DatabaseTeam = {
  id: number;
  name: string;
  starting_credits: number;
};

type DatabasePlayer = {
  id: number;
  name: string;
  role: Role;
  club: string;
  quotation: number | null;
};

type DatabasePurchase = {
  id: number;
  player_id: number;
  team_id: number;
  price: number;
  created_at: string;
};

type EditingPurchase = {
  playerId: number;
  currentTeamId: number;
  selectedTeamId: number;
  price: string;
};

function calculateSpent(team: Team) {
  return team.players.reduce((total, player) => {
    return total + (player.price ?? 0);
  }, 0);
}

function calculateCredits(team: Team) {
  return team.startingCredits - calculateSpent(team);
}

function calculateMaxBid(team: Team) {
  const credits = calculateCredits(team);

  const totalSlots = Object.values(
    roleLimits,
  ).reduce(
    (total, limit) => total + limit,
    0,
  );

  const missingPlayers =
    totalSlots - team.players.length;

  if (missingPlayers <= 0) {
    return 0;
  }

  return Math.max(
    0,
    credits - (missingPlayers - 1),
  );
}

function getRolePlayers(
  team: Team,
  role: Role,
) {
  return team.players.filter(
    (player) => player.role === role,
  );
}

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function App() {
  const [teams, setTeams] =
    useState<Team[]>([]);

  const [allPlayers, setAllPlayers] =
    useState<Player[]>([]);

  const [purchases, setPurchases] =
    useState<DatabasePurchase[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");

  const [isAdminOpen, setIsAdminOpen] =
    useState(false);

  const [
    playerSearch,
    setPlayerSearch,
  ] = useState("");

  const [
    selectedPlayerId,
    setSelectedPlayerId,
  ] = useState<number | null>(null);

  const [
    selectedTeamId,
    setSelectedTeamId,
  ] = useState<number | null>(null);

  const [price, setPrice] =
    useState("");

  const [
    editingPurchase,
    setEditingPurchase,
  ] =
    useState<EditingPurchase | null>(
      null,
    );

  const [isSaving, setIsSaving] =
    useState(false);

  const [
    lastPurchase,
    setLastPurchase,
  ] = useState<{
    player: Player;
    teamName: string;
  } | null>(null);

  const loadAuctionData =
    useCallback(async () => {
      setIsLoading(true);
      setLoadError("");

      const [
        {
          data: teamsData,
          error: teamsError,
        },
        {
          data: playersData,
          error: playersError,
        },
        {
          data: purchasesData,
          error: purchasesError,
        },
      ] = await Promise.all([
        supabase
          .from("teams")
          .select("*")
          .order("id"),

        supabase
          .from("players")
          .select("*")
          .order("name"),

        supabase
          .from("purchases")
          .select("*")
          .order("created_at", {
            ascending: true,
          }),
      ]);

      if (
        teamsError ||
        playersError ||
        purchasesError
      ) {
        console.error(
          "Errore caricamento Supabase:",
          {
            teamsError,
            playersError,
            purchasesError,
          },
        );

        setLoadError(
          "Impossibile caricare i dati dell'asta.",
        );

        setIsLoading(false);

        return;
      }

      const databaseTeams =
        (teamsData ??
          []) as DatabaseTeam[];

      const databasePlayers =
        (playersData ??
          []) as DatabasePlayer[];

      const databasePurchases =
        (purchasesData ??
          []) as DatabasePurchase[];

      const mappedPlayers: Player[] =
        databasePlayers.map(
          (player) => ({
            id: player.id,
            name: player.name,
            role: player.role,
            club: player.club,
            quotation:
              player.quotation,
          }),
        );

      const mappedTeams: Team[] =
        databaseTeams.map((team) => {
          const teamPurchases =
            databasePurchases.filter(
              (purchase) =>
                purchase.team_id ===
                team.id,
            );

          const teamPlayers =
            teamPurchases
              .map((purchase) => {
                const player =
                  mappedPlayers.find(
                    (candidate) =>
                      candidate.id ===
                      purchase.player_id,
                  );

                if (!player) {
                  return null;
                }

                return {
                  ...player,
                  price:
                    purchase.price,
                };
              })
              .filter(
                (
                  player,
                ): player is Player =>
                  player !== null,
              );

          return {
            id: team.id,
            name: team.name,
            startingCredits:
              team.starting_credits,
            players: teamPlayers,
          };
        });

      setAllPlayers(mappedPlayers);
      setPurchases(
        databasePurchases,
      );
      setTeams(mappedTeams);

      const latestPurchase =
        databasePurchases.length > 0
          ? databasePurchases[
              databasePurchases.length -
                1
            ]
          : null;

      if (latestPurchase) {
        const player =
          mappedPlayers.find(
            (candidate) =>
              candidate.id ===
              latestPurchase.player_id,
          );

        const team =
          mappedTeams.find(
            (candidate) =>
              candidate.id ===
              latestPurchase.team_id,
          );

        if (player && team) {
          setLastPurchase({
            player: {
              ...player,
              price:
                latestPurchase.price,
            },

            teamName: team.name,
          });
        } else {
          setLastPurchase(null);
        }
      } else {
        setLastPurchase(null);
      }

      setIsLoading(false);
    }, []);

  useEffect(() => {
    void loadAuctionData();

    const channel = supabase
      .channel(
        "fantasta-purchases",
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "purchases",
        },
        (payload) => {
          console.log(
            "Realtime event ricevuto:",
            payload,
          );

          void loadAuctionData();
        },
      )
      .subscribe((status) => {
        console.log(
          "Realtime status:",
          status,
        );
      });

    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [loadAuctionData]);

  const assignedPlayerIds =
    useMemo(() => {
      return new Set(
        purchases.map(
          (purchase) =>
            purchase.player_id,
        ),
      );
    }, [purchases]);

  const remainingPlayers =
    useMemo(() => {
      return allPlayers.filter(
        (player) =>
          !assignedPlayerIds.has(
            player.id,
          ),
      );
    }, [
      allPlayers,
      assignedPlayerIds,
    ]);

  const searchResults =
    useMemo(() => {
      const query =
        normalizeSearch(
          playerSearch.trim(),
        );

      if (!query) {
        return [];
      }

      return remainingPlayers
        .filter((player) => {
          const searchable =
            normalizeSearch(
              `${player.name} ${player.club} ${player.role}`,
            );

          return searchable.includes(
            query,
          );
        })
        .slice(0, 8);
    }, [
      playerSearch,
      remainingPlayers,
    ]);

  const selectedPlayer =
    remainingPlayers.find(
      (player) =>
        player.id ===
        selectedPlayerId,
    ) ?? null;

  const selectedTeam =
    teams.find(
      (team) =>
        team.id ===
        selectedTeamId,
    ) ?? null;

  const editingPlayer =
    editingPurchase
      ? allPlayers.find(
          (player) =>
            player.id ===
            editingPurchase.playerId,
        ) ?? null
      : null;

  function selectPlayer(
    player: Player,
  ) {
    setSelectedPlayerId(
      player.id,
    );

    setPlayerSearch(
      player.name,
    );
  }

  function clearSelectedPlayer() {
    setSelectedPlayerId(null);
    setPlayerSearch("");
  }

  function openAdmin() {
    setPlayerSearch("");
    setSelectedPlayerId(null);
    setSelectedTeamId(null);
    setPrice("");
    setIsAdminOpen(true);
  }

  async function assignPlayer() {
    if (
      !selectedPlayer ||
      !selectedTeam ||
      isSaving
    ) {
      return;
    }

    const parsedPrice =
      Number(price);

    if (
      !Number.isFinite(
        parsedPrice,
      ) ||
      parsedPrice <= 0
    ) {
      alert(
        "Inserisci un prezzo valido.",
      );

      return;
    }

    const roleCount =
      getRolePlayers(
        selectedTeam,
        selectedPlayer.role,
      ).length;

    if (
      roleCount >=
      roleLimits[
        selectedPlayer.role
      ]
    ) {
      alert(
        `La squadra ha già completato il ruolo ${selectedPlayer.role}.`,
      );

      return;
    }

    const maxBid =
      calculateMaxBid(
        selectedTeam,
      );

    if (
      parsedPrice > maxBid
    ) {
      alert(
        `Il massimo spendibile è ${maxBid} crediti.`,
      );

      return;
    }

    setIsSaving(true);

    const { error } =
      await supabase
        .from("purchases")
        .insert({
          player_id:
            selectedPlayer.id,

          team_id:
            selectedTeam.id,

          price: parsedPrice,
        });

    if (error) {
      console.error(
        "Errore inserimento acquisto:",
        error,
      );

      if (
        error.code === "23505"
      ) {
        alert(
          "Questo giocatore è già stato assegnato.",
        );
      } else {
        alert(
          "Errore durante il salvataggio dell'acquisto.",
        );
      }

      setIsSaving(false);

      return;
    }

    setSelectedPlayerId(null);
    setSelectedTeamId(null);
    setPlayerSearch("");
    setPrice("");
    setIsAdminOpen(false);

    await loadAuctionData();

    setIsSaving(false);
  }

  function openEditPurchase(
    player: Player,
    teamId: number,
  ) {
    setEditingPurchase({
      playerId: player.id,
      currentTeamId: teamId,
      selectedTeamId: teamId,
      price: String(
        player.price ?? 1,
      ),
    });
  }

  async function saveEditedPurchase() {
    if (
      !editingPurchase ||
      !editingPlayer ||
      isSaving
    ) {
      return;
    }

    const parsedPrice =
      Number(
        editingPurchase.price,
      );

    if (
      !Number.isFinite(
        parsedPrice,
      ) ||
      parsedPrice <= 0
    ) {
      alert(
        "Inserisci un prezzo valido.",
      );

      return;
    }

    const destinationTeam =
      teams.find(
        (team) =>
          team.id ===
          editingPurchase.selectedTeamId,
      );

    const currentTeam =
      teams.find(
        (team) =>
          team.id ===
          editingPurchase.currentTeamId,
      );

    if (
      !destinationTeam ||
      !currentTeam
    ) {
      return;
    }

    const movingToAnotherTeam =
      editingPurchase.selectedTeamId !==
      editingPurchase.currentTeamId;

    if (movingToAnotherTeam) {
      const roleCount =
        getRolePlayers(
          destinationTeam,
          editingPlayer.role,
        ).length;

      if (
        roleCount >=
        roleLimits[
          editingPlayer.role
        ]
      ) {
        alert(
          `La squadra di destinazione ha già completato il ruolo ${editingPlayer.role}.`,
        );

        return;
      }

      const destinationMaxBid =
        calculateMaxBid(
          destinationTeam,
        );

      if (
        parsedPrice >
        destinationMaxBid
      ) {
        alert(
          `La squadra di destinazione può spendere al massimo ${destinationMaxBid} crediti.`,
        );

        return;
      }
    } else {
      const oldPrice =
        editingPlayer.price ?? 0;

      const creditsAfterRefund =
        calculateCredits(
          currentTeam,
        ) + oldPrice;

      const totalSlots =
        Object.values(
          roleLimits,
        ).reduce(
          (total, limit) =>
            total + limit,
          0,
        );

      const missingPlayers =
        totalSlots -
        currentTeam.players
          .length;

      const maxSpendable =
        creditsAfterRefund -
        Math.max(
          0,
          missingPlayers - 1,
        );

      if (
        parsedPrice >
        maxSpendable
      ) {
        alert(
          `Con questa modifica la squadra può spendere al massimo ${maxSpendable} crediti.`,
        );

        return;
      }
    }

    setIsSaving(true);

    const { error } =
      await supabase
        .from("purchases")
        .update({
          team_id:
            editingPurchase.selectedTeamId,

          price: parsedPrice,
        })
        .eq(
          "player_id",
          editingPurchase.playerId,
        );

    if (error) {
      console.error(
        "Errore modifica acquisto:",
        error,
      );

      alert(
        "Errore durante la modifica dell'acquisto.",
      );

      setIsSaving(false);

      return;
    }

    setEditingPurchase(null);

    await loadAuctionData();

    setIsSaving(false);
  }

  async function deletePurchase() {
    if (
      !editingPurchase ||
      isSaving
    ) {
      return;
    }

    const confirmDelete =
      window.confirm(
        "Vuoi davvero eliminare questa assegnazione?",
      );

    if (!confirmDelete) {
      return;
    }

    setIsSaving(true);

    const { error } =
      await supabase
        .from("purchases")
        .delete()
        .eq(
          "player_id",
          editingPurchase.playerId,
        );

    if (error) {
      console.error(
        "Errore eliminazione acquisto:",
        error,
      );

      alert(
        "Errore durante l'eliminazione dell'acquisto.",
      );

      setIsSaving(false);

      return;
    }

    setEditingPurchase(null);

    await loadAuctionData();

    setIsSaving(false);
  }

  async function resetAuction() {
    if (isSaving) {
      return;
    }

    const confirmed =
      window.confirm(
        "Vuoi davvero resettare tutta l'asta?\n\nTutti gli acquisti verranno cancellati e tutti i giocatori torneranno disponibili.\n\nIl Listone NON verrà modificato.",
      );

    if (!confirmed) {
      return;
    }

    const doubleConfirmed =
      window.confirm(
        "Conferma definitiva: cancellare TUTTI gli acquisti?",
      );

    if (!doubleConfirmed) {
      return;
    }

    setIsSaving(true);

    const { error } =
      await supabase
        .from("purchases")
        .delete()
        .gt("id", 0);

    if (error) {
      console.error(
        "Errore reset asta:",
        error,
      );

      alert(
        "Errore durante il reset dell'asta.",
      );

      setIsSaving(false);

      return;
    }

    setEditingPurchase(null);
    setSelectedPlayerId(null);
    setSelectedTeamId(null);
    setPlayerSearch("");
    setPrice("");
    setLastPurchase(null);

    await loadAuctionData();

    setIsSaving(false);

    alert(
      "Asta resettata. Tutti i giocatori sono di nuovo disponibili.",
    );
  }

  if (
    isLoading &&
    teams.length === 0
  ) {
    return (
      <div className="auction-app">
        <header className="main-header">
          <div>
            <p className="eyebrow">
              Asta Fantacalcio
            </p>

            <h1>FantAsta</h1>
          </div>
        </header>

        <p>
          Caricamento asta...
        </p>
      </div>
    );
  }

  if (
    loadError &&
    teams.length === 0
  ) {
    return (
      <div className="auction-app">
        <header className="main-header">
          <div>
            <p className="eyebrow">
              Asta Fantacalcio
            </p>

            <h1>FantAsta</h1>
          </div>
        </header>

        <p>{loadError}</p>

        <button
          className="admin-button"
          onClick={
            loadAuctionData
          }
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="auction-app">
      <header className="main-header">
        <div>
          <p className="eyebrow">
            Asta Fantacalcio
          </p>

          <h1>FantAsta</h1>
        </div>

        <div className="header-actions">
          <button className="secondary-button">
            Modalità TV
          </button>

          <button
            className="admin-button"
            onClick={openAdmin}
          >
            Admin
          </button>
        </div>
      </header>

      <main>
        <section className="current-player-panel">
          <div>
            <p className="current-label">
              {lastPurchase
                ? "Ultimo acquisto"
                : "Pronto per l'asta"}
            </p>

            {lastPurchase ? (
              <>
                <div className="current-role">
                  {
                    lastPurchase
                      .player.role
                  }
                </div>

                <h2>
                  {
                    lastPurchase
                      .player.name
                  }
                </h2>

                <p className="current-club">
                  {
                    lastPurchase
                      .player.club
                  }

                  {" · "}

                  {
                    lastPurchase
                      .teamName
                  }

                  {lastPurchase.player
                    .quotation != null &&
                    ` · Q ${lastPurchase.player.quotation}`}
                </p>
              </>
            ) : (
              <>
                <h2>
                  Nessun giocatore
                  assegnato
                </h2>

                <p className="current-club">
                  Usa il pannello
                  Admin per registrare
                  il primo acquisto.
                </p>
              </>
            )}
          </div>

          {lastPurchase && (
            <div className="current-price">
              <strong>
                {
                  lastPurchase
                    .player.price
                }
              </strong>

              <span>
                crediti
              </span>
            </div>
          )}
        </section>

        <div className="board-wrapper">
          <div className="board">
            {teams.map(
              (team) => {
                const credits =
                  calculateCredits(
                    team,
                  );

                const maxBid =
                  calculateMaxBid(
                    team,
                  );

                return (
                  <article
                    className="team-column"
                    key={team.id}
                  >
                    <header className="team-header">
                      <div className="team-name-row">
                        <span className="status-dot" />

                        <h2>
                          {team.name}
                        </h2>
                      </div>

                      <div className="credit-value">
                        <span className="coin">
                          C
                        </span>

                        <strong>
                          {credits}
                        </strong>
                      </div>

                      <div className="team-stats">
                        <div>
                          <span>
                            max
                          </span>

                          <strong>
                            {maxBid}
                          </strong>
                        </div>

                        <div>
                          <span>
                            giocatori
                          </span>

                          <strong>
                            {
                              team
                                .players
                                .length
                            }
                            /25
                          </strong>
                        </div>
                      </div>

                      <div className="role-counter">
                        {roles.map(
                          (role) => (
                            <div
                              key={
                                role
                              }
                            >
                              <span>
                                {role}
                              </span>

                              <strong>
                                {
                                  getRolePlayers(
                                    team,
                                    role,
                                  )
                                    .length
                                }

                                <small>
                                  /
                                  {
                                    roleLimits[
                                      role
                                    ]
                                  }
                                </small>
                              </strong>
                            </div>
                          ),
                        )}
                      </div>
                    </header>

                    <div className="team-roster">
                      {roles.map(
                        (role) => {
                          const players =
                            getRolePlayers(
                              team,
                              role,
                            );

                          const emptySlots =
                            roleLimits[
                              role
                            ] -
                            players.length;

                          return (
                            <section
                              className={`role-section role-${role}`}
                              key={
                                role
                              }
                            >
                              <div className="role-header">
                                <strong>
                                  {
                                    role
                                  }
                                </strong>

                                <span>
                                  {
                                    players.length
                                  }
                                  /
                                  {
                                    roleLimits[
                                      role
                                    ]
                                  }
                                </span>
                              </div>

                              <div className="players-list">
                                {players.map(
                                  (
                                    player,
                                  ) => (
                                    <button
                                      className="player-slot filled editable-player"
                                      key={
                                        player.id
                                      }
                                      onClick={() =>
                                        openEditPurchase(
                                          player,
                                          team.id,
                                        )
                                      }
                                    >
                                      <span className="player-name">
                                        {
                                          player.name
                                        }
                                      </span>

                                      <div className="player-info">
                                        <span className="player-price">
                                          {
                                            player.price
                                          }
                                        </span>

                                        <span className="mini-role">
                                          {
                                            player.role
                                          }
                                        </span>
                                      </div>
                                    </button>
                                  ),
                                )}

                                {Array.from(
                                  {
                                    length:
                                      emptySlots,
                                  },
                                ).map(
                                  (
                                    _,
                                    index,
                                  ) => (
                                    <div
                                      className="player-slot empty"
                                      key={`${role}-empty-${index}`}
                                    />
                                  ),
                                )}
                              </div>
                            </section>
                          );
                        },
                      )}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </div>
      </main>

      {isAdminOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setIsAdminOpen(
                false,
              );
            }
          }}
        >
          <section
            className="admin-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="admin-modal-header">
              <div>
                <p className="eyebrow">
                  Gestione asta
                </p>

                <h2>
                  Registra acquisto
                </h2>
              </div>

              <button
                className="close-button"
                onClick={() =>
                  setIsAdminOpen(
                    false,
                  )
                }
                disabled={isSaving}
              >
                ×
              </button>
            </div>

            <div className="admin-form">
              <label>
                Cerca giocatore

                <input
                  type="text"
                  value={
                    playerSearch
                  }
                  onChange={(
                    event,
                  ) => {
                    setPlayerSearch(
                      event.target
                        .value,
                    );

                    setSelectedPlayerId(
                      null,
                    );
                  }}
                  placeholder="Es. Lautaro"
                  autoFocus
                  autoComplete="off"
                  disabled={
                    isSaving
                  }
                />
              </label>

              {!selectedPlayer &&
                playerSearch.trim()
                  .length > 0 && (
                  <div
                    style={{
                      display:
                        "grid",
                      gap: "6px",
                    }}
                  >
                    {searchResults.length >
                    0 ? (
                      searchResults.map(
                        (
                          player,
                        ) => (
                          <button
                            key={
                              player.id
                            }
                            type="button"
                            className="player-slot filled editable-player"
                            onClick={() =>
                              selectPlayer(
                                player,
                              )
                            }
                          >
                            <span className="player-name">
                              {
                                player.name
                              }
                            </span>

                            <div className="player-info">
                              <span>
                                {
                                  player.club
                                }
                              </span>

                              <span className="mini-role">
                                {
                                  player.role
                                }
                              </span>

                              <span className="player-price">
                                Q{" "}
                                {player.quotation ??
                                  "-"}
                              </span>
                            </div>
                          </button>
                        ),
                      )
                    ) : (
                      <p>
                        Nessun giocatore
                        disponibile
                        trovato.
                      </p>
                    )}
                  </div>
                )}

              {selectedPlayer && (
                <div className="admin-summary">
                  <div>
                    <span>
                      Giocatore
                    </span>

                    <strong>
                      {
                        selectedPlayer.name
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Ruolo
                    </span>

                    <strong>
                      {
                        selectedPlayer.role
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Squadra
                    </span>

                    <strong>
                      {
                        selectedPlayer.club
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Quotazione
                    </span>

                    <strong>
                      {selectedPlayer.quotation ??
                        "-"}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      clearSelectedPlayer
                    }
                    disabled={
                      isSaving
                    }
                  >
                    Cambia giocatore
                  </button>
                </div>
              )}

              <label>
                Squadra

                <select
                  value={
                    selectedTeamId ??
                    ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedTeamId(
                      event.target
                        .value
                        ? Number(
                            event
                              .target
                              .value,
                          )
                        : null,
                    )
                  }
                  disabled={
                    isSaving
                  }
                >
                  <option value="">
                    Seleziona squadra
                  </option>

                  {teams.map(
                    (team) => (
                      <option
                        key={
                          team.id
                        }
                        value={
                          team.id
                        }
                      >
                        {
                          team.name
                        }{" "}
                        ·{" "}
                        {calculateCredits(
                          team,
                        )}{" "}
                        cr
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Prezzo

                <input
                  type="number"
                  min="1"
                  value={price}
                  onChange={(
                    event,
                  ) =>
                    setPrice(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Es. 37"
                  disabled={
                    isSaving
                  }
                />
              </label>

              {selectedTeam && (
                <div className="admin-summary">
                  <div>
                    <span>
                      Crediti
                    </span>

                    <strong>
                      {calculateCredits(
                        selectedTeam,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Max spendibile
                    </span>

                    <strong>
                      {calculateMaxBid(
                        selectedTeam,
                      )}
                    </strong>
                  </div>
                </div>
              )}

              <button
                className="assign-button"
                onClick={
                  assignPlayer
                }
                disabled={
                  !selectedPlayerId ||
                  !selectedTeamId ||
                  !price ||
                  isSaving
                }
              >
                {isSaving
                  ? "Salvataggio..."
                  : "Assegna giocatore"}
              </button>

              <ListoneImport
                onImportComplete={
                  loadAuctionData
                }
              />

              <section
                style={{
                  marginTop: "24px",
                  paddingTop: "20px",
                  borderTop:
                    "1px solid rgba(255,255,255,.12)",
                }}
              >
                <p className="eyebrow">
                  Gestione asta
                </p>

                <h3>
                  Reset asta
                </h3>

                <p
                  style={{
                    opacity: 0.7,
                    lineHeight: 1.5,
                  }}
                >
                  Cancella tutti gli
                  acquisti registrati e
                  rende nuovamente
                  disponibili tutti i
                  giocatori. Il Listone
                  non viene modificato.
                </p>

                <button
                  type="button"
                  className="delete-button"
                  onClick={() =>
                    void resetAuction()
                  }
                  disabled={isSaving}
                >
                  Reset completo asta
                </button>
              </section>
            </div>
          </section>
        </div>
      )}

      {editingPurchase &&
        editingPlayer && (
          <div
            className="modal-backdrop"
            onClick={() => {
              if (!isSaving) {
                setEditingPurchase(
                  null,
                );
              }
            }}
          >
            <section
              className="admin-modal"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="admin-modal-header">
                <div>
                  <p className="eyebrow">
                    Modifica rosa
                  </p>

                  <h2>
                    {
                      editingPlayer.name
                    }
                  </h2>

                  <p className="edit-player-meta">
                    {
                      editingPlayer.role
                    }{" "}
                    ·{" "}
                    {
                      editingPlayer.club
                    }

                    {editingPlayer.quotation !=
                      null &&
                      ` · Q ${editingPlayer.quotation}`}
                  </p>
                </div>

                <button
                  className="close-button"
                  onClick={() =>
                    setEditingPurchase(
                      null,
                    )
                  }
                  disabled={
                    isSaving
                  }
                >
                  ×
                </button>
              </div>

              <div className="admin-form">
                <label>
                  Squadra

                  <select
                    value={
                      editingPurchase.selectedTeamId
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditingPurchase(
                        (
                          current,
                        ) =>
                          current
                            ? {
                                ...current,

                                selectedTeamId:
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ),
                              }
                            : null,
                      )
                    }
                    disabled={
                      isSaving
                    }
                  >
                    {teams.map(
                      (team) => (
                        <option
                          key={
                            team.id
                          }
                          value={
                            team.id
                          }
                        >
                          {
                            team.name
                          }{" "}
                          ·{" "}
                          {calculateCredits(
                            team,
                          )}{" "}
                          cr
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Prezzo

                  <input
                    type="number"
                    min="1"
                    value={
                      editingPurchase.price
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditingPurchase(
                        (
                          current,
                        ) =>
                          current
                            ? {
                                ...current,

                                price:
                                  event
                                    .target
                                    .value,
                              }
                            : null,
                      )
                    }
                    disabled={
                      isSaving
                    }
                  />
                </label>

                <div className="edit-actions">
                  <button
                    className="delete-button"
                    onClick={
                      deletePurchase
                    }
                    disabled={
                      isSaving
                    }
                  >
                    Elimina
                    assegnazione
                  </button>

                  <button
                    className="assign-button"
                    onClick={
                      saveEditedPurchase
                    }
                    disabled={
                      isSaving
                    }
                  >
                    {isSaving
                      ? "Salvataggio..."
                      : "Salva modifiche"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
    </div>
  );
}

export default App;