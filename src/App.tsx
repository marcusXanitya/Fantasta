import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./App.css";

import type { Session } from "@supabase/supabase-js";

import {
  type Player,
  type Role,
  type RoleLimits,
  type Team,
} from "./data";

import { supabase } from "./supabase";
import ListoneImport from "./ListoneImport";

const roles: Role[] = ["P", "D", "C", "A"];

const defaultRoleLimits: RoleLimits = {
  P: 3,
  D: 8,
  C: 8,
  A: 6,
};

type DatabaseTeam = {
  id: number;
  name: string;
  starting_credits: number;
  sort_order: number | null;
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

type DatabaseLeagueSettings = {
  id: number;
  league_name: string;
  goalkeeper_slots: number;
  defender_slots: number;
  midfielder_slots: number;
  forward_slots: number;
};

type LeagueSettings = {
  leagueName: string;
  roleLimits: RoleLimits;
};

type EditingPurchase = {
  playerId: number;
  currentTeamId: number;
  selectedTeamId: number;
  price: string;
};

type DraftTeam = {
  id?: number;
  name: string;
  startingCredits: string;
};

type LeagueDraft = {
  leagueName: string;
  goalkeeperSlots: string;
  defenderSlots: string;
  midfielderSlots: string;
  forwardSlots: string;
  teams: DraftTeam[];
};

function calculateSpent(team: Team) {
  return team.players.reduce(
    (total, player) =>
      total + (player.price ?? 0),
    0,
  );
}

function calculateCredits(team: Team) {
  return (
    team.startingCredits -
    calculateSpent(team)
  );
}

function calculateTotalSlots(
  roleLimits: RoleLimits,
) {
  return Object.values(
    roleLimits,
  ).reduce(
    (total, limit) =>
      total + limit,
    0,
  );
}

function calculateMaxBid(
  team: Team,
  roleLimits: RoleLimits,
) {
  const credits =
    calculateCredits(team);

  const totalSlots =
    calculateTotalSlots(
      roleLimits,
    );

  const missingPlayers =
    totalSlots -
    team.players.length;

  if (missingPlayers <= 0) {
    return 0;
  }

  return Math.max(
    0,
    credits -
      (missingPlayers - 1),
  );
}

function getRolePlayers(
  team: Team,
  role: Role,
) {
  return team.players.filter(
    (player) =>
      player.role === role,
  );
}

function normalizeSearch(
  value: string,
) {
  return value
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    );
}

function App() {
  const isTvMode =
    window.location.pathname.replace(/\/+$/, "") === "/tv";

  const [teams, setTeams] =
    useState<Team[]>([]);

  const [
    allPlayers,
    setAllPlayers,
  ] = useState<Player[]>([]);

  const [
    purchases,
    setPurchases,
  ] =
    useState<
      DatabasePurchase[]
    >([]);

  const [calledPlayerId, setCalledPlayerId] = useState<number | null>(null);
  const [isCallingPlayer, setIsCallingPlayer] = useState(false);

  const [
    leagueSettings,
    setLeagueSettings,
  ] =
    useState<LeagueSettings>({
      leagueName: "FantAsta",
      roleLimits:
        defaultRoleLimits,
    });

  const [
    leagueDraft,
    setLeagueDraft,
  ] = useState<LeagueDraft>({
    leagueName: "FantAsta",
    goalkeeperSlots: "3",
    defenderSlots: "8",
    midfielderSlots: "8",
    forwardSlots: "6",
    teams: [],
  });

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    isAdminOpen,
    setIsAdminOpen,
  ] = useState(false);

  const [
    session,
    setSession,
  ] = useState<Session | null>(null);

  const [
    isAuthLoading,
    setIsAuthLoading,
  ] = useState(true);

  const [
    isLoginOpen,
    setIsLoginOpen,
  ] = useState(false);

  const [
    loginEmail,
    setLoginEmail,
  ] = useState("");

  const [
    loginPassword,
    setLoginPassword,
  ] = useState("");

  const [
    loginError,
    setLoginError,
  ] = useState("");

  const [
    isLoggingIn,
    setIsLoggingIn,
  ] = useState(false);

  const [
    playerSearch,
    setPlayerSearch,
  ] = useState("");

  const [
    selectedPlayerId,
    setSelectedPlayerId,
  ] =
    useState<number | null>(
      null,
    );

  const [
    selectedTeamId,
    setSelectedTeamId,
  ] =
    useState<number | null>(
      null,
    );

  const [price, setPrice] =
    useState("");

  const [
    editingPurchase,
    setEditingPurchase,
  ] =
    useState<
      EditingPurchase | null
    >(null);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isSavingLeague,
    setIsSavingLeague,
  ] = useState(false);

  const loadAuctionData =
    useCallback(
      async () => {
        setIsLoading(true);
        setLoadError("");

        const [
          {
            data: teamsData,
            error: teamsError,
          },
          {
            data: playersData,
            error:
              playersError,
          },
          {
            data:
              purchasesData,
            error:
              purchasesError,
          },
          {
            data:
              settingsData,
            error:
              settingsError,
          },
        ] =
          await Promise.all([
            supabase
              .from("teams")
              .select("*")
              .order(
                "sort_order",
                {
                  ascending: true,
                  nullsFirst:
                    false,
                },
              )
              .order("id"),

            supabase
              .from("players")
              .select("*")
              .order("name"),

            supabase
              .from(
                "purchases",
              )
              .select("*")
              .order(
                "created_at",
                {
                  ascending: true,
                },
              ),

            supabase
              .from(
                "league_settings",
              )
              .select("*")
              .eq("id", 1)
              .maybeSingle(),
          ]);

        if (
          teamsError ||
          playersError ||
          purchasesError ||
          settingsError
        ) {
          console.error(
            "Errore caricamento Supabase:",
            {
              teamsError,
              playersError,
              purchasesError,
              settingsError,
            },
          );

          setLoadError(
            "Impossibile caricare i dati dell'asta.",
          );

          setIsLoading(
            false,
          );

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

        const databaseSettings =
          settingsData as DatabaseLeagueSettings | null;

        const newRoleLimits: RoleLimits =
          databaseSettings
            ? {
                P:
                  databaseSettings.goalkeeper_slots,
                D:
                  databaseSettings.defender_slots,
                C:
                  databaseSettings.midfielder_slots,
                A:
                  databaseSettings.forward_slots,
              }
            : defaultRoleLimits;

        const newLeagueSettings: LeagueSettings =
          {
            leagueName:
              databaseSettings?.league_name ??
              "FantAsta",

            roleLimits:
              newRoleLimits,
          };

        const mappedPlayers: Player[] =
          databasePlayers.map(
            (player) => ({
              id: player.id,
              name:
                player.name,
              role:
                player.role,
              club:
                player.club,
              quotation:
                player.quotation,
            }),
          );

        const mappedTeams: Team[] =
          databaseTeams.map(
            (team) => {
              const teamPurchases =
                databasePurchases.filter(
                  (
                    purchase,
                  ) =>
                    purchase.team_id ===
                    team.id,
                );

              const teamPlayers: Player[] =
                teamPurchases.flatMap(
                  (purchase) => {
                    const player =
                      mappedPlayers.find(
                        (candidate) =>
                          candidate.id ===
                          purchase.player_id,
                      );

                    if (!player) {
                      return [];
                    }

                    return [
                      {
                        ...player,
                        price:
                          purchase.price,
                      },
                    ];
                  },
                );

              return {
                id: team.id,
                name:
                  team.name,
                startingCredits:
                  team.starting_credits,
                players:
                  teamPlayers,
              };
            },
          );

        setLeagueSettings(
          newLeagueSettings,
        );

        setAllPlayers(
          mappedPlayers,
        );

        setPurchases(
          databasePurchases,
        );

        setTeams(
          mappedTeams,
        );



        setIsLoading(
          false,
        );
      },
      [],
    );

  const loadCalledPlayer = useCallback(async () => {
    const { data, error } = await supabase
      .from("auction_state")
      .select("called_player_id")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Errore lettura giocatore chiamato:", error);
      return;
    }

    setCalledPlayerId(data?.called_player_id ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) {
          return;
        }

        if (error) {
          console.error(
            "Errore lettura sessione:",
            error,
          );
        }

        setSession(
          data.session ?? null,
        );

        setIsAuthLoading(false);
      });

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          setSession(
            nextSession,
          );

          setIsAuthLoading(false);

          if (!nextSession) {
            setIsAdminOpen(
              false,
            );

            setEditingPurchase(
              null,
            );
          }
        },
      );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void loadAuctionData();
    void loadCalledPlayer();

    const channel =
      supabase
        .channel(
          "fantasta-auction",
        )
        .on(
          "broadcast",
          {
            event:
              "auction-change",
          },
          (payload) => {
            console.log(
              "Realtime broadcast ricevuto:",
              payload,
            );
            void loadAuctionData();
            void loadCalledPlayer();
          },
        )
        .subscribe(
          (status) => {
            console.log(
              "Realtime status:",
              status,
            );
          },
        );

    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [loadAuctionData, loadCalledPlayer]);

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
        .filter(
          (player) => {
            const searchable =
              normalizeSearch(
                `${player.name} ${player.club} ${player.role}`,
              );

            return searchable.includes(
              query,
            );
          },
        )
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

  const calledPlayer =
    allPlayers.find((player) => player.id === calledPlayerId) ?? null;

  async function callSelectedPlayer() {
    if (!selectedPlayer || !session || isCallingPlayer) return;
    setIsCallingPlayer(true);
    const { error } = await supabase
      .from("auction_state")
      .update({ called_player_id: selectedPlayer.id, called_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) {
      console.error("Errore chiamata giocatore:", error);
      alert("Errore durante la chiamata del giocatore.");
      setIsCallingPlayer(false);
      return;
    }
    setCalledPlayerId(selectedPlayer.id);
    setIsCallingPlayer(false);
    window.setTimeout(() => quickTeamRef.current?.focus(), 0);
  }



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

  const recentPurchases =
    useMemo(() => {
      return purchases
        .slice(-5)
        .reverse()
        .map((purchase) => {
          const player =
            allPlayers.find(
              (candidate) =>
                candidate.id ===
                purchase.player_id,
            );

          const team =
            teams.find(
              (candidate) =>
                candidate.id ===
                purchase.team_id,
            );

          if (!player || !team) {
            return null;
          }

          return {
            purchaseId:
              purchase.id,
            teamId: team.id,
            teamName: team.name,
            player: {
              ...player,
              price:
                purchase.price,
            },
          };
        })
        .filter(
          (purchase): purchase is NonNullable<typeof purchase> =>
            purchase !== null,
        );
    }, [
      purchases,
      allPlayers,
      teams,
    ]);

  function buildLeagueDraft() {
    setLeagueDraft({
      leagueName:
        leagueSettings.leagueName,

      goalkeeperSlots:
        String(
          leagueSettings
            .roleLimits.P,
        ),

      defenderSlots:
        String(
          leagueSettings
            .roleLimits.D,
        ),

      midfielderSlots:
        String(
          leagueSettings
            .roleLimits.C,
        ),

      forwardSlots:
        String(
          leagueSettings
            .roleLimits.A,
        ),

      teams: teams.map(
        (team) => ({
          id: team.id,
          name:
            team.name,
          startingCredits:
            String(
              team.startingCredits,
            ),
        }),
      ),
    });
  }

  const quickSearchRef = useRef<HTMLInputElement>(null);
  const quickTeamRef = useRef<HTMLSelectElement>(null);
  const quickPriceRef = useRef<HTMLInputElement>(null);
  const [quickResultIndex, setQuickResultIndex] = useState(0);

  function handleQuickSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      clearSelectedPlayer();
      return;
    }

    if (selectedPlayer || searchResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setQuickResultIndex((current) =>
        Math.min(current + 1, searchResults.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setQuickResultIndex((current) =>
        Math.max(current - 1, 0),
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectPlayer(searchResults[quickResultIndex] ?? searchResults[0]);
    }
  }

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
    setQuickResultIndex(0);

    window.setTimeout(() => {
      quickSearchRef.current?.focus();
    }, 0);
  }

  function openAdmin() {
    if (!session) {
      setLoginError("");
      setLoginPassword("");
      setIsLoginOpen(true);
      return;
    }

    setPlayerSearch("");
    setSelectedPlayerId(
      null,
    );
    setSelectedTeamId(
      null,
    );
    setPrice("");

    buildLeagueDraft();

    setIsAdminOpen(true);
  }

  async function loginAdmin() {
    if (
      isLoggingIn ||
      !loginEmail.trim() ||
      !loginPassword
    ) {
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    const { data, error } =
      await supabase.auth
        .signInWithPassword({
          email:
            loginEmail.trim(),
          password:
            loginPassword,
        });

    if (error) {
      console.error(
        "Errore login Admin:",
        error,
      );

      setLoginError(
        "Email o password non corretti.",
      );

      setIsLoggingIn(false);
      return;
    }

    setSession(
      data.session,
    );

    setLoginPassword("");
    setIsLoginOpen(false);
    setIsLoggingIn(false);

    setPlayerSearch("");
    setSelectedPlayerId(
      null,
    );
    setSelectedTeamId(
      null,
    );
    setPrice("");

    buildLeagueDraft();

    setIsAdminOpen(true);
  }

  async function logoutAdmin() {
    if (
      isSaving ||
      isSavingLeague
    ) {
      return;
    }

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Errore logout Admin:",
        error,
      );

      alert(
        "Errore durante il logout.",
      );

      return;
    }

    setSession(null);
    setIsAdminOpen(false);
    setEditingPurchase(null);
  }

  function addDraftTeam() {
    setLeagueDraft(
      (current) => ({
        ...current,

        teams: [
          ...current.teams,
          {
            name: `Squadra ${
              current.teams
                .length + 1
            }`,

            startingCredits:
              current.teams[0]
                ?.startingCredits ??
              "500",
          },
        ],
      }),
    );
  }

  function removeDraftTeam(
    index: number,
  ) {
    if (
      leagueDraft.teams
        .length <= 2
    ) {
      alert(
        "La lega deve avere almeno 2 squadre.",
      );

      return;
    }

    setLeagueDraft(
      (current) => ({
        ...current,

        teams:
          current.teams.filter(
            (_, teamIndex) =>
              teamIndex !==
              index,
          ),
      }),
    );
  }

  function updateDraftTeam(
    index: number,
    field:
      | "name"
      | "startingCredits",
    value: string,
  ) {
    setLeagueDraft(
      (current) => ({
        ...current,

        teams:
          current.teams.map(
            (
              team,
              teamIndex,
            ) =>
              teamIndex ===
              index
                ? {
                    ...team,
                    [field]:
                      value,
                  }
                : team,
          ),
      }),
    );
  }

  async function saveLeagueConfiguration() {
    if (
      isSavingLeague ||
      isSaving
    ) {
      return;
    }

    const leagueName =
      leagueDraft.leagueName.trim();

    const newRoleLimits: RoleLimits =
      {
        P: Number(
          leagueDraft.goalkeeperSlots,
        ),
        D: Number(
          leagueDraft.defenderSlots,
        ),
        C: Number(
          leagueDraft.midfielderSlots,
        ),
        A: Number(
          leagueDraft.forwardSlots,
        ),
      };

    if (!leagueName) {
      alert(
        "Inserisci un nome per la lega.",
      );

      return;
    }

    if (
      Object.values(
        newRoleLimits,
      ).some(
        (value) =>
          !Number.isInteger(
            value,
          ) || value < 0,
      )
    ) {
      alert(
        "Gli slot devono essere numeri interi uguali o superiori a 0.",
      );

      return;
    }

    const totalSlots =
      calculateTotalSlots(
        newRoleLimits,
      );

    if (
      totalSlots <= 0
    ) {
      alert(
        "La rosa deve avere almeno uno slot.",
      );

      return;
    }

    if (
      leagueDraft.teams
        .length < 2
    ) {
      alert(
        "La lega deve avere almeno 2 squadre.",
      );

      return;
    }

    const preparedTeams =
      leagueDraft.teams.map(
        (team, index) => ({
          ...team,

          name:
            team.name.trim(),

          credits: Number(
            team.startingCredits,
          ),

          sortOrder:
            index + 1,
        }),
      );

    if (
      preparedTeams.some(
        (team) =>
          !team.name,
      )
    ) {
      alert(
        "Ogni squadra deve avere un nome.",
      );

      return;
    }

    if (
      preparedTeams.some(
        (team) =>
          !Number.isInteger(
            team.credits,
          ) ||
          team.credits <
            totalSlots,
      )
    ) {
      alert(
        `Ogni squadra deve avere almeno ${totalSlots} crediti, perché ogni giocatore costa almeno 1 credito.`,
      );

      return;
    }

    const normalizedNames =
      preparedTeams.map(
        (team) =>
          normalizeSearch(
            team.name,
          ),
      );

    if (
      new Set(
        normalizedNames,
      ).size !==
      normalizedNames.length
    ) {
      alert(
        "Due squadre non possono avere lo stesso nome.",
      );

      return;
    }

    const draftExistingIds =
      new Set(
        preparedTeams
          .filter(
            (team) =>
              team.id != null,
          )
          .map(
            (team) =>
              team.id as number,
          ),
      );

    const teamsToDelete =
      teams.filter(
        (team) =>
          !draftExistingIds.has(
            team.id,
          ),
      );

    const teamsWithPlayersToDelete =
      teamsToDelete.filter(
        (team) =>
          team.players.length >
          0,
      );

    if (
      teamsWithPlayersToDelete
        .length > 0
    ) {
      const confirmed =
        window.confirm(
          `Stai eliminando ${teamsWithPlayersToDelete.length} squadre che hanno già giocatori acquistati.\n\nEliminando queste squadre verranno cancellati anche i loro acquisti.\n\nVuoi continuare?`,
        );

      if (!confirmed) {
        return;
      }
    }

    setIsSavingLeague(
      true,
    );

    try {
      const {
        error:
          settingsError,
      } = await supabase
        .from(
          "league_settings",
        )
        .upsert(
          {
            id: 1,

            league_name:
              leagueName,

            goalkeeper_slots:
              newRoleLimits.P,

            defender_slots:
              newRoleLimits.D,

            midfielder_slots:
              newRoleLimits.C,

            forward_slots:
              newRoleLimits.A,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "id",
          },
        );

      if (settingsError) {
        throw settingsError;
      }

      for (
        let index = 0;
        index <
        preparedTeams.length;
        index += 1
      ) {
        const team =
          preparedTeams[index];

        if (
          team.id != null
        ) {
          const {
            error:
              updateError,
          } = await supabase
            .from("teams")
            .update({
              name:
                team.name,

              starting_credits:
                team.credits,

              sort_order:
                team.sortOrder,
            })
            .eq(
              "id",
              team.id,
            );

          if (
            updateError
          ) {
            throw updateError;
          }
        } else {
          const {
            error:
              insertError,
          } = await supabase
            .from("teams")
            .insert({
              name:
                team.name,

              starting_credits:
                team.credits,

              sort_order:
                team.sortOrder,
            });

          if (
            insertError
          ) {
            throw insertError;
          }
        }
      }

      if (
        teamsToDelete.length >
        0
      ) {
        const {
          error:
            deleteError,
        } = await supabase
          .from("teams")
          .delete()
          .in(
            "id",
            teamsToDelete.map(
              (team) =>
                team.id,
            ),
          );

        if (
          deleteError
        ) {
          throw deleteError;
        }
      }

      await loadAuctionData();

      alert(
        "Configurazione lega salvata.",
      );
    } catch (
      caughtError
    ) {
      console.error(
        "Errore configurazione lega:",
        caughtError,
      );

      alert(
        "Errore durante il salvataggio della configurazione.",
      );
    } finally {
      setIsSavingLeague(
        false,
      );
    }
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
      leagueSettings
        .roleLimits[
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
        leagueSettings.roleLimits,
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

          price:
            parsedPrice,
        });

    if (error) {
      console.error(
        "Errore inserimento acquisto:",
        error,
      );

      if (
        error.code ===
        "23505"
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

    await supabase
      .from("auction_state")
      .update({ called_player_id: null, called_at: null })
      .eq("id", 1);
    setCalledPlayerId(null);

    setSelectedPlayerId(
      null,
    );

    setSelectedTeamId(
      null,
    );

    setPlayerSearch("");
    setPrice("");
    setIsAdminOpen(false);

    await loadAuctionData();

    setIsSaving(false);

    window.setTimeout(() => {
      quickSearchRef.current?.focus();
    }, 0);
  }

  function openEditPurchase(
    player: Player,
    teamId: number,
  ) {
    if (!session) {
      setLoginError("");
      setLoginPassword("");
      setIsLoginOpen(true);
      return;
    }

    setEditingPurchase({
      playerId: player.id,
      currentTeamId:
        teamId,
      selectedTeamId:
        teamId,
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

    if (
      movingToAnotherTeam
    ) {
      const roleCount =
        getRolePlayers(
          destinationTeam,
          editingPlayer.role,
        ).length;

      if (
        roleCount >=
        leagueSettings
          .roleLimits[
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
          leagueSettings.roleLimits,
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
        editingPlayer.price ??
        0;

      const creditsAfterRefund =
        calculateCredits(
          currentTeam,
        ) + oldPrice;

      const totalSlots =
        calculateTotalSlots(
          leagueSettings.roleLimits,
        );

      const missingPlayers =
        totalSlots -
        currentTeam.players
          .length;

      const maxSpendable =
        creditsAfterRefund -
        Math.max(
          0,
          missingPlayers -
            1,
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

          price:
            parsedPrice,
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

    setEditingPurchase(
      null,
    );

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

    setEditingPurchase(
      null,
    );

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

    if (
      !doubleConfirmed
    ) {
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

    setEditingPurchase(
      null,
    );

    setSelectedPlayerId(
      null,
    );

    setSelectedTeamId(
      null,
    );

    setPlayerSearch("");
    setPrice("");

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

            <h1>
              FantAsta
            </h1>
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

            <h1>
              FantAsta
            </h1>
          </div>
        </header>

        <p>
          {loadError}
        </p>

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

  const totalRosterSlots =
    calculateTotalSlots(
      leagueSettings.roleLimits,
    );

  if (isTvMode) {
    return (
      <div
        style={{
          minHeight: "100vh",
          height: "100vh",
          overflow: "hidden",
          background: "#0d0f13",
          color: "#f4f6f8",
          padding: "clamp(10px, 1.1vw, 20px)",
          display: "grid",
          gridTemplateRows: "auto auto auto minmax(0, 1fr)",
          gap: "clamp(8px, .8vw, 14px)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            minHeight: "48px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "14px",
              minWidth: 0,
            }}
          >
            <strong
              style={{
                fontSize: "clamp(22px, 1.8vw, 34px)",
                letterSpacing: "-.04em",
                whiteSpace: "nowrap",
              }}
            >
              FantAsta
            </strong>
            <span
              style={{
                color: "rgba(255,255,255,.68)",
                fontSize: "clamp(13px, .9vw, 18px)",
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {leagueSettings.leagueName}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: "#48d597",
                boxShadow: "0 0 12px rgba(72,213,151,.75)",
              }}
            />
            <strong
              style={{
                fontSize: "clamp(11px, .7vw, 14px)",
                letterSpacing: ".12em",
              }}
            >
              LIVE
            </strong>
          </div>
        </header>

        <section
          style={{
            minHeight: "76px",
            borderRadius: "12px",
            border: calledPlayer ? "1px solid rgba(103,232,249,.35)" : "1px solid rgba(255,255,255,.06)",
            background: calledPlayer ? "rgba(103,232,249,.07)" : "rgba(255,255,255,.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "8px 20px",
          }}
        >
          {calledPlayer ? (
            <div>
              <div style={{ fontSize: "clamp(9px,.62vw,12px)", fontWeight: 800, letterSpacing: ".16em", color: "rgba(103,232,249,.8)", textTransform: "uppercase" }}>Giocatore all'asta</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginTop: "4px" }}>
                <span style={{ fontSize: "clamp(26px,2.6vw,50px)", lineHeight: 1, fontWeight: 950, letterSpacing: "-.035em" }}>
                  {calledPlayer.name} <span style={{ color: "rgba(255,255,255,.5)", fontWeight: 750 }}>({calledPlayer.club})</span>
                </span>
                <span
                  className={`role-badge role-${calledPlayer.role.toLowerCase()}`}
                  style={{
                    fontSize: "clamp(22px,1.8vw,32px)",
                    width: "clamp(46px,3.3vw,64px)",
                    height: "clamp(46px,3.3vw,64px)",
                    flex: "0 0 auto",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,.22)",
                    boxShadow: "0 8px 24px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.14)",
                    fontWeight: 950,
                    lineHeight: 1,
                  }}
                >
                  {calledPlayer.role}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: "rgba(255,255,255,.28)", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", fontSize: "clamp(10px,.7vw,13px)" }}>In attesa della prossima chiamata</div>
          )}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: "8px",
          }}
        >
          {Array.from({ length: 5 }).map((_, index) => {
            const item = recentPurchases[index];

            if (!item) {
              return (
                <div
                  key={`tv-recent-empty-${index}`}
                  style={{
                    minHeight: "52px",
                    border: "1px solid rgba(255,255,255,.06)",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,.02)",
                  }}
                />
              );
            }

            return (
              <div
                key={item.purchaseId}
                style={{
                  minWidth: 0,
                  padding: "8px 10px",
                  borderRadius: "10px",
                  border:
                    index === 0
                      ? "1px solid rgba(255,255,255,.20)"
                      : "1px solid rgba(255,255,255,.08)",
                  background:
                    index === 0
                      ? "rgba(255,255,255,.08)"
                      : "rgba(255,255,255,.035)",
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr) auto",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span className={`role-badge role-${item.player.role.toLowerCase()}`}>
                  {item.player.role}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "clamp(11px, .75vw, 15px)",
                      fontWeight: 800,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.player.name} <span style={{ color: "rgba(255,255,255,.48)", fontWeight: 650 }}>({item.player.club})</span>
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,.62)",
                      fontSize: "clamp(9px, .58vw, 12px)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.teamName}
                  </div>
                </div>
                <strong style={{ fontSize: "clamp(14px, 1vw, 20px)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span className="coin">C</span>{item.player.price}
                </strong>
              </div>
            );
          })}
        </section>

        <section
          style={{
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(teams.length, 1)}, minmax(0, 1fr))`,
            gap: "clamp(4px, .42vw, 8px)",
          }}
        >
          {teams.map((team) => {
            const credits = calculateCredits(team);
            const maxBid = calculateMaxBid(team, leagueSettings.roleLimits);

            return (
              <article
                key={team.id}
                style={{
                  minWidth: 0,
                  minHeight: 0,
                  overflow: "hidden",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "#15181e",
                  display: "grid",
                  gridTemplateRows: "auto minmax(0, 1fr)",
                }}
              >
                <header
                  style={{
                    padding: "clamp(7px, .55vw, 11px)",
                    borderBottom: "1px solid rgba(255,255,255,.09)",
                    background: "rgba(255,255,255,.035)",
                  }}
                >
                  <div
                    style={{
                      minHeight: "30px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "5px",
                    }}
                  >
                    <strong
                      title={team.name}
                      style={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "clamp(12px, .88vw, 18px)",
                      }}
                    >
                      {team.name}
                    </strong>
                    <span
                      style={{
                        fontSize: "clamp(14px, 1.15vw, 23px)",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {credits}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "5px",
                      color: "rgba(255,255,255,.48)",
                      fontSize: "clamp(8px, .5vw, 10px)",
                    }}
                  >
                    <span>max {maxBid}</span>
                    <span>{team.players.length}/{totalRosterSlots}</span>
                  </div>
                </header>

                <div
                  style={{
                    minHeight: 0,
                    overflow: "hidden",
                    display: "grid",
                    gridTemplateRows: `repeat(${roles.length}, minmax(0, auto))`,
                    alignContent: "start",
                  }}
                >
                  {roles.map((role) => {
                    const rolePlayers = getRolePlayers(team, role);
                    const emptySlots = Math.max(
                      0,
                      leagueSettings.roleLimits[role] - rolePlayers.length,
                    );

                    return (
                      <section
                        key={role}
                        style={{
                          minWidth: 0,
                          borderBottom: "1px solid rgba(255,255,255,.055)",
                        }}
                      >
                        <div
                          style={{
                            height: "clamp(16px, 1.25vh, 22px)",
                            padding: "0 6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "clamp(8px, .5vw, 10px)",
                            fontWeight: 900,
                            color: "rgba(255,255,255,.72)",
                          }}
                        >
                          <span>{role}</span>
                          <span>{rolePlayers.length}/{leagueSettings.roleLimits[role]}</span>
                        </div>

                        {rolePlayers.map((player) => (
                          <div
                            key={player.id}
                            style={{
                              height: "clamp(18px, 1.78vh, 27px)",
                              minWidth: 0,
                              padding: "0 6px",
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1fr) auto",
                              alignItems: "center",
                              gap: "4px",
                              borderTop: "1px solid rgba(255,255,255,.035)",
                            }}
                          >
                            <span
                              title={player.name}
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: 700,
                                fontSize: "clamp(8px, .55vw, 11px)",
                              }}
                            >
                              {player.name}
                            </span>
                            <strong
                              style={{
                                fontSize: "clamp(8px, .55vw, 11px)",
                              }}
                            >
                              {player.price}
                            </strong>
                          </div>
                        ))}

                        {Array.from({ length: emptySlots }).map((_, index) => (
                          <div
                            key={`${team.id}-${role}-tv-empty-${index}`}
                            style={{
                              height: "clamp(18px, 1.78vh, 27px)",
                              borderTop: "1px solid rgba(255,255,255,.025)",
                              background: "rgba(255,255,255,.008)",
                            }}
                          />
                        ))}
                      </section>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    );
  }

  return (
    <div className="auction-app">
      <style>{`
        @media (max-width: 980px) {
          .main-header {
            align-items: flex-start;
            gap: 14px;
            flex-wrap: wrap;
          }

          .header-actions {
            width: 100%;
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 2px;
          }

          .header-actions button {
            flex: 0 0 auto;
          }

          .quick-auction-panel {
            padding: 16px !important;
            border-radius: 18px !important;
          }

          .quick-auction-grid {
            grid-template-columns: 1fr 1fr !important;
          }

          .teams-board {
            overflow-x: auto !important;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 10px;
          }

          .team-column {
            scroll-snap-align: start;
          }
        }

        @media (max-width: 640px) {
          .auction-app {
            padding: 14px !important;
          }

          .main-header h1 {
            font-size: clamp(28px, 10vw, 42px) !important;
          }

          .quick-auction-panel {
            margin-bottom: 16px !important;
            padding: 14px !important;
          }

          .quick-auction-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .quick-auction-grid input,
          .quick-auction-grid select,
          .quick-auction-grid button {
            min-height: 54px !important;
          }

          .current-player-panel {
            padding: 14px !important;
            border-radius: 16px !important;
          }

          .teams-board {
            display: grid !important;
            grid-auto-flow: column;
            grid-auto-columns: minmax(270px, 82vw);
            grid-template-columns: none !important;
            gap: 10px !important;
            overflow-x: auto !important;
            scroll-snap-type: x mandatory;
            overscroll-behavior-x: contain;
          }

          .team-column {
            min-width: 0 !important;
            scroll-snap-align: start;
          }

          .team-name-row h2 {
            font-size: 20px !important;
          }

          .modal-backdrop {
            padding: 10px !important;
          }

          .admin-modal {
            max-height: calc(100vh - 20px) !important;
            padding: 16px !important;
            border-radius: 16px !important;
          }
        }
      `}</style>
      <header className="main-header">
        <div>
          <p className="eyebrow">
            FantAsta · Asta
            Fantacalcio
          </p>

          <h1>
            {
              leagueSettings.leagueName
            }
          </h1>
        </div>

        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={() =>
              window.open(
                `${window.location.origin}/tv`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            Modalità TV
          </button>

          {session ? (
            <>
              <button
                className="admin-button"
                onClick={openAdmin}
              >
                Admin
              </button>

              <button
                className="secondary-button"
                onClick={() =>
                  void logoutAdmin()
                }
                disabled={
                  isSaving ||
                  isSavingLeague
                }
              >
                Esci
              </button>
            </>
          ) : (
            <button
              className="admin-button"
              onClick={openAdmin}
              disabled={
                isAuthLoading
              }
            >
              {isAuthLoading
                ? "..."
                : "Admin"}
            </button>
          )}
        </div>
      </header>

      <main>
        {session && (
          <section
            className="quick-auction-panel"
            style={{
              marginBottom: "24px",
              padding: "22px",
              border: "1px solid rgba(255,255,255,.16)",
              borderRadius: "22px",
              background:
                "linear-gradient(135deg, rgba(34,39,49,.98), rgba(18,21,27,.98))",
              boxShadow:
                "0 18px 55px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.05)",
              position: "relative",
              zIndex: 20,
              overflow: "visible",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "18px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <p
                  className="eyebrow"
                  style={{
                    margin: "0 0 5px",
                    fontSize: "12px",
                    letterSpacing: ".14em",
                  }}
                >
                  CONTROLLO ADMIN
                </p>

                <h2
                  style={{
                    margin: 0,
                    fontSize: "clamp(24px, 2.3vw, 34px)",
                    lineHeight: 1.05,
                    letterSpacing: "-.03em",
                  }}
                >
                  Asta rapida
                </h2>

                <p
                  style={{
                    margin: "7px 0 0",
                    color: "rgba(255,255,255,.58)",
                    fontSize: "14px",
                  }}
                >
                  Cerca il giocatore, scegli la squadra, inserisci il prezzo e premi Invio.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "999px",
                  background: "rgba(103, 232, 249, .08)",
                  border: "1px solid rgba(103, 232, 249, .18)",
                  color: "rgba(255,255,255,.8)",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "999px",
                    background: "#67e8f9",
                    boxShadow: "0 0 12px rgba(103,232,249,.8)",
                  }}
                />
                Pronto
              </div>
            </div>

            <div
              className="quick-auction-grid"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(300px, 2fr) minmax(130px,.7fr) minmax(210px,1.1fr) minmax(135px,.65fr) minmax(145px,.7fr)",
                gap: "14px",
                alignItems: "stretch",
              }}
            >
              <label
                style={{
                  position: "relative",
                  display: "grid",
                  gap: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "rgba(255,255,255,.72)",
                }}
              >
                <span>1 · Cerca giocatore</span>

                <div style={{ position: "relative" }}>
                  <input
                    ref={quickSearchRef}
                    type="text"
                    value={playerSearch}
                    onChange={(event) => {
                      setPlayerSearch(event.target.value);
                      setSelectedPlayerId(null);
                      setQuickResultIndex(0);
                    }}
                    onKeyDown={handleQuickSearchKeyDown}
                    placeholder="Scrivi nome, squadra o ruolo…"
                    autoComplete="off"
                    disabled={isSaving}
                    style={{
                      width: "100%",
                      minHeight: "58px",
                      padding: "0 18px",
                      borderRadius: "14px",
                      border: selectedPlayer
                        ? "1px solid rgba(103,232,249,.55)"
                        : "1px solid rgba(255,255,255,.16)",
                      background: selectedPlayer
                        ? "rgba(103,232,249,.07)"
                        : "rgba(5,7,10,.48)",
                      color: "#fff",
                      fontSize: "18px",
                      fontWeight: 700,
                      outline: "none",
                      boxShadow: selectedPlayer
                        ? "0 0 0 3px rgba(103,232,249,.06)"
                        : "none",
                    }}
                  />

                  {selectedPlayer && (
                    <button
                      type="button"
                      onClick={clearSelectedPlayer}
                      disabled={isSaving}
                      title="Cambia giocatore"
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "34px",
                        height: "34px",
                        border: "1px solid rgba(255,255,255,.15)",
                        borderRadius: "10px",
                        background: "rgba(0,0,0,.2)",
                        color: "rgba(255,255,255,.7)",
                        cursor: "pointer",
                        fontSize: "18px",
                      }}
                    >
                      ×
                    </button>
                  )}

                  {!selectedPlayer &&
                    playerSearch.trim().length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "100%",
                          marginTop: "8px",
                          padding: "8px",
                          display: "grid",
                          gap: "6px",
                          background: "#11151c",
                          border: "1px solid rgba(255,255,255,.16)",
                          borderRadius: "14px",
                          boxShadow: "0 22px 55px rgba(0,0,0,.55)",
                          maxHeight: "330px",
                          overflowY: "auto",
                          zIndex: 100,
                        }}
                      >
                        {searchResults.length > 0 ? (
                          searchResults.map((player, index) => (
                            <button
                              key={player.id}
                              type="button"
                              className="player-slot filled editable-player"
                              onClick={() => selectPlayer(player)}
                              onMouseEnter={() => setQuickResultIndex(index)}
                              style={{
                                minHeight: "48px",
                                outline: index === quickResultIndex
                                  ? "2px solid rgba(103,232,249,.7)"
                                  : "none",
                                background: index === quickResultIndex
                                  ? "rgba(103,232,249,.10)"
                                  : undefined,
                                textAlign: "left",
                                padding: "10px 12px",
                              }}
                            >
                              <span className="player-name">
                                {player.name}
                              </span>

                              <div className="player-info">
                                <span>{player.club}</span>
                                <span className="mini-role">
                                  {player.role}
                                </span>
                                <span className="player-price">
                                  Q {player.quotation ?? "-"}
                                </span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <p
                            style={{
                              margin: "8px",
                              color: "rgba(255,255,255,.6)",
                            }}
                          >
                            Nessun giocatore disponibile trovato.
                          </p>
                        )}
                      </div>
                    )}
                </div>
              </label>

              <div style={{ display: "grid", gap: "8px", fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,.72)" }}>
                <span>2 · Chiamata</span>
                <button
                  type="button"
                  onClick={() => void callSelectedPlayer()}
                  disabled={!selectedPlayer || isCallingPlayer || isSaving}
                  style={{ minHeight: "58px", borderRadius: "14px", border: "1px solid rgba(103,232,249,.35)", background: selectedPlayer ? "rgba(103,232,249,.13)" : "rgba(255,255,255,.035)", color: selectedPlayer ? "#dffbff" : "rgba(255,255,255,.3)", fontSize: "15px", fontWeight: 900, cursor: selectedPlayer ? "pointer" : "not-allowed" }}
                >
                  {isCallingPlayer ? "..." : calledPlayer?.id === selectedPlayer?.id ? "CHIAMATO" : "CHIAMA"}
                </button>
              </div>

              <label
                style={{
                  display: "grid",
                  gap: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "rgba(255,255,255,.72)",
                }}
              >
                <span>3 · Squadra</span>
                <select
                  ref={quickTeamRef}
                  value={selectedTeamId ?? ""}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      clearSelectedPlayer();
                    }
                  }}
                  onChange={(event) => {
                    setSelectedTeamId(
                      event.target.value
                        ? Number(event.target.value)
                        : null,
                    );

                    if (event.target.value) {
                      window.setTimeout(
                        () => quickPriceRef.current?.focus(),
                        0,
                      );
                    }
                  }}
                  disabled={isSaving || !selectedPlayer || calledPlayer?.id !== selectedPlayer.id}
                  style={{
                    width: "100%",
                    minHeight: "58px",
                    padding: "0 14px",
                    borderRadius: "14px",
                    border: "1px solid rgba(255,255,255,.16)",
                    background: "rgba(5,7,10,.48)",
                    color: "#fff",
                    fontSize: "16px",
                    fontWeight: 700,
                    outline: "none",
                  }}
                >
                  <option value="">Seleziona squadra</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} · {calculateCredits(team)} cr
                    </option>
                  ))}
                </select>
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "rgba(255,255,255,.72)",
                }}
              >
                <span>4 · Prezzo</span>
                <input
                  ref={quickPriceRef}
                  type="number"
                  min="1"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      selectedPlayerId &&
                      selectedTeamId &&
                      price &&
                      !isSaving
                    ) {
                      event.preventDefault();
                      void assignPlayer();
                    }
                  }}
                  placeholder="0"
                  disabled={isSaving}
                  style={{
                    width: "100%",
                    minHeight: "58px",
                    padding: "0 16px",
                    borderRadius: "14px",
                    border: "1px solid rgba(255,255,255,.16)",
                    background: "rgba(5,7,10,.48)",
                    color: "#fff",
                    fontSize: "24px",
                    fontWeight: 800,
                    outline: "none",
                  }}
                />
              </label>

              <div
                style={{
                  display: "grid",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "rgba(255,255,255,.72)",
                  }}
                >
                  4 · Conferma
                </span>

                <button
                  type="button"
                  className="assign-button"
                  onClick={() => void assignPlayer()}
                  disabled={
                    !selectedPlayerId ||
                    !selectedTeamId ||
                    !price ||
                    isSaving
                  }
                  style={{
                    minHeight: "58px",
                    padding: "0 22px",
                    borderRadius: "14px",
                    whiteSpace: "nowrap",
                    fontSize: "16px",
                    fontWeight: 900,
                    letterSpacing: ".02em",
                    boxShadow:
                      selectedPlayerId && selectedTeamId && price
                        ? "0 10px 30px rgba(0,0,0,.28)"
                        : "none",
                  }}
                >
                  {isSaving ? "Salvataggio…" : "ASSEGNA"}
                </button>
              </div>
            </div>

            {selectedPlayer && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "13px 15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                  borderRadius: "14px",
                  border: "1px solid rgba(103,232,249,.15)",
                  background: "rgba(103,232,249,.045)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "12px",
                      border: "1px solid rgba(255,255,255,.12)",
                      background: "rgba(255,255,255,.06)",
                      fontSize: "17px",
                      fontWeight: 900,
                    }}
                  >
                    {selectedPlayer.role}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "17px",
                        lineHeight: 1.2,
                      }}
                    >
                      {selectedPlayer.name}
                    </strong>
                    <span
                      style={{
                        display: "block",
                        marginTop: "3px",
                        color: "rgba(255,255,255,.56)",
                        fontSize: "13px",
                      }}
                    >
                      {selectedPlayer.club} · Quotazione {selectedPlayer.quotation ?? "-"}
                    </span>
                  </div>
                </div>

                {selectedTeam && (
                  <div
                    style={{
                      display: "flex",
                      gap: "18px",
                      alignItems: "center",
                      color: "rgba(255,255,255,.62)",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                    }}
                  >
                    <span>
                      Crediti <strong style={{ color: "#fff" }}>{calculateCredits(selectedTeam)}</strong>
                    </span>
                    <span>
                      Max <strong style={{ color: "#fff" }}>{calculateMaxBid(selectedTeam, leagueSettings.roleLimits)}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <section
          style={{
            margin: "0 0 14px",
            minHeight: "96px",
            borderRadius: "16px",
            border: calledPlayer ? "1px solid rgba(103,232,249,.28)" : "1px solid rgba(255,255,255,.08)",
            background: calledPlayer ? "rgba(103,232,249,.055)" : "rgba(255,255,255,.025)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "14px 20px",
          }}
        >
          {calledPlayer ? (
            <div>
              <div style={{ color: "#67e8f9", fontSize: "11px", fontWeight: 850, letterSpacing: ".15em", textTransform: "uppercase" }}>Giocatore all'asta</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginTop: "5px" }}>
                <span style={{ fontSize: "clamp(28px,3vw,48px)", lineHeight: 1, fontWeight: 950, letterSpacing: "-.04em" }}>
                  {calledPlayer.name} <span style={{ color: "rgba(255,255,255,.48)", fontWeight: 700 }}>({calledPlayer.club})</span>
                </span>
                <span
                  className={`role-badge role-${calledPlayer.role.toLowerCase()}`}
                  style={{
                    fontSize: "clamp(22px,1.8vw,30px)",
                    width: "clamp(48px,3.2vw,58px)",
                    height: "clamp(48px,3.2vw,58px)",
                    flex: "0 0 auto",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,.22)",
                    boxShadow: "0 8px 22px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.14)",
                    fontWeight: 950,
                    lineHeight: 1,
                  }}
                >
                  {calledPlayer.role}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: "rgba(255,255,255,.3)", fontWeight: 750 }}>Nessun giocatore chiamato</div>
          )}
        </section>

        <section
          className="current-player-panel"
          style={{
            display: "block",
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              marginBottom:
                recentPurchases.length > 0
                  ? "12px"
                  : 0,
            }}
          >
            <div>
              <p
                className="current-label"
                style={{
                  marginBottom: "3px",
                }}
              >
                Cronologia asta
              </p>

              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                }}
              >
                Ultimi acquisti
              </h2>
            </div>

            <span
              style={{
                color: "rgba(255,255,255,.46)",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: ".06em",
                whiteSpace: "nowrap",
              }}
            >
              {recentPurchases.length}/5
            </span>
          </div>

          {recentPurchases.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(190px, 1fr))",
                gap: "8px",
              }}
            >
              {recentPurchases.map(
                (item, index) => {
                  const content = (
                    <>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          marginBottom: "6px",
                        }}
                      >
                        <span
                          className={`role-badge role-${item.player.role.toLowerCase()}`}
                          style={{
                            minWidth: "28px",
                            textAlign: "center",
                          }}
                        >
                          {item.player.role}
                        </span>

                        <strong
                          style={{
                            fontSize: index === 0
                              ? "18px"
                              : "16px",
                            color: "#fff",
                          }}
                        >
                          <span className="coin">C</span> {item.player.price}
                        </strong>
                      </div>

                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: index === 0
                            ? "15px"
                            : "14px",
                          color: "#fff",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={item.player.name}
                      >
                        {item.player.name} <span style={{ color: "rgba(255,255,255,.48)", fontWeight: 650 }}>({item.player.club})</span>
                      </div>

                      <div
                        style={{
                          marginTop: "2px",
                          color: "rgba(255,255,255,.58)",
                          fontSize: "12px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={`${item.teamName} · ${item.player.club}`}
                      >
                        {item.teamName}
                      </div>
                    </>
                  );

                  const commonStyle = {
                    width: "100%",
                    minWidth: 0,
                    padding: index === 0
                      ? "13px 14px"
                      : "11px 12px",
                    borderRadius: "12px",
                    border: index === 0
                      ? "1px solid rgba(255,255,255,.20)"
                      : "1px solid rgba(255,255,255,.09)",
                    background: index === 0
                      ? "rgba(255,255,255,.075)"
                      : "rgba(255,255,255,.035)",
                    textAlign: "left" as const,
                  };

                  return session ? (
                    <button
                      key={item.purchaseId}
                      type="button"
                      onClick={() =>
                        openEditPurchase(
                          item.player,
                          item.teamId,
                        )
                      }
                      title="Modifica acquisto"
                      style={{
                        ...commonStyle,
                        cursor: "pointer",
                        color: "inherit",
                      }}
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      key={item.purchaseId}
                      style={commonStyle}
                    >
                      {content}
                    </div>
                  );
                },
              )}
            </div>
          ) : (
            <p
              className="current-club"
              style={{
                margin: 0,
              }}
            >
              Nessun acquisto registrato.
            </p>
          )}
        </section>

        <div className="board-wrapper">
          <div
            className="board"
            style={{
              gridTemplateColumns: `repeat(${teams.length}, minmax(165px, 1fr))`,

              minWidth: `${Math.max(
                teams.length *
                  170,
                340,
              )}px`,
            }}
          >
            {teams.map(
              (team) => {
                const credits =
                  calculateCredits(
                    team,
                  );

                const maxBid =
                  calculateMaxBid(
                    team,
                    leagueSettings.roleLimits,
                  );

                return (
                  <article
                    className="team-column"
                    key={
                      team.id
                    }
                  >
                    <header className="team-header">
                      <div className="team-name-row">
                        <span className="status-dot" />

                        <h2 style={{ fontSize: "20px" }}>
                          {team.name}
                        </h2>
                      </div>

                      <div className="credit-value">
                        <span className="coin">
                          C
                        </span>

                        <strong>
                          {
                            credits
                          }
                        </strong>
                      </div>

                      <div className="team-stats">
                        <div>
                          <span>
                            max
                          </span>

                          <strong>
                            {
                              maxBid
                            }
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
                            /
                            {
                              totalRosterSlots
                            }
                          </strong>
                        </div>
                      </div>

                      <div className="role-counter">
                        {roles.map(
                          (
                            role,
                          ) => (
                            <div
                              key={
                                role
                              }
                            >
                              <span>
                                {
                                  role
                                }
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
                                    leagueSettings
                                      .roleLimits[
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
                        (
                          role,
                        ) => {
                          const players =
                            getRolePlayers(
                              team,
                              role,
                            );

                          const emptySlots =
                            Math.max(
                              0,
                              leagueSettings
                                .roleLimits[
                                role
                              ] -
                                players.length,
                            );

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
                                    leagueSettings
                                      .roleLimits[
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

      {isLoginOpen && !session && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!isLoggingIn) {
              setIsLoginOpen(
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
                  Accesso riservato
                </p>

                <h2>
                  Login Admin
                </h2>
              </div>

              <button
                className="close-button"
                onClick={() =>
                  setIsLoginOpen(
                    false,
                  )
                }
                disabled={
                  isLoggingIn
                }
              >
                ×
              </button>
            </div>

            <div className="admin-form">
              <label>
                Email

                <input
                  type="email"
                  value={
                    loginEmail
                  }
                  onChange={(event) =>
                    setLoginEmail(
                      event.target
                        .value,
                    )
                  }
                  autoComplete="email"
                  autoFocus
                  disabled={
                    isLoggingIn
                  }
                />
              </label>

              <label>
                Password

                <input
                  type="password"
                  value={
                    loginPassword
                  }
                  onChange={(event) =>
                    setLoginPassword(
                      event.target
                        .value,
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      void loginAdmin();
                    }
                  }}
                  autoComplete="current-password"
                  disabled={
                    isLoggingIn
                  }
                />
              </label>

              {loginError && (
                <p
                  style={{
                    margin: 0,
                    color:
                      "#ff8b8b",
                  }}
                >
                  {loginError}
                </p>
              )}

              <button
                className="assign-button"
                onClick={() =>
                  void loginAdmin()
                }
                disabled={
                  isLoggingIn ||
                  !loginEmail.trim() ||
                  !loginPassword
                }
              >
                {isLoggingIn
                  ? "Accesso..."
                  : "Accedi come Admin"}
              </button>
            </div>
          </section>
        </div>
      )}

      {isAdminOpen && session && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (
              !isSaving &&
              !isSavingLeague
            ) {
              setIsAdminOpen(
                false,
              );
            }
          }}
        >
          <section
            className="admin-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <div className="admin-modal-header">
              <div>
                <p className="eyebrow">
                  Gestione asta
                </p>

                <h2>
                  Registra
                  acquisto
                </h2>
              </div>

              <button
                className="close-button"
                onClick={() =>
                  setIsAdminOpen(
                    false,
                  )
                }
                disabled={
                  isSaving ||
                  isSavingLeague
                }
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
                  .length >
                  0 && (
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
                        Nessun
                        giocatore
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
                    Cambia
                    giocatore
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
                    Seleziona
                    squadra
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
                      Max
                      spendibile
                    </span>

                    <strong>
                      {calculateMaxBid(
                        selectedTeam,
                        leagueSettings.roleLimits,
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

              <section
                style={{
                  marginTop:
                    "24px",
                  paddingTop:
                    "20px",
                  borderTop:
                    "1px solid rgba(255,255,255,.12)",
                }}
              >
                <p className="eyebrow">
                  Configurazione
                </p>

                <h3>
                  Configurazione
                  lega
                </h3>

                <p
                  style={{
                    opacity: 0.7,
                    lineHeight:
                      1.5,
                  }}
                >
                  Imposta nome
                  della lega,
                  composizione
                  delle rose,
                  squadre e
                  crediti
                  iniziali.
                </p>

                <label>
                  Nome lega

                  <input
                    type="text"
                    value={
                      leagueDraft.leagueName
                    }
                    onChange={(
                      event,
                    ) =>
                      setLeagueDraft(
                        (
                          current,
                        ) => ({
                          ...current,

                          leagueName:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    disabled={
                      isSavingLeague
                    }
                  />
                </label>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(4, minmax(0, 1fr))",
                    gap: "8px",
                    marginTop:
                      "12px",
                  }}
                >
                  <label>
                    P

                    <input
                      type="number"
                      min="0"
                      value={
                        leagueDraft.goalkeeperSlots
                      }
                      onChange={(
                        event,
                      ) =>
                        setLeagueDraft(
                          (
                            current,
                          ) => ({
                            ...current,

                            goalkeeperSlots:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    D

                    <input
                      type="number"
                      min="0"
                      value={
                        leagueDraft.defenderSlots
                      }
                      onChange={(
                        event,
                      ) =>
                        setLeagueDraft(
                          (
                            current,
                          ) => ({
                            ...current,

                            defenderSlots:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    C

                    <input
                      type="number"
                      min="0"
                      value={
                        leagueDraft.midfielderSlots
                      }
                      onChange={(
                        event,
                      ) =>
                        setLeagueDraft(
                          (
                            current,
                          ) => ({
                            ...current,

                            midfielderSlots:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    A

                    <input
                      type="number"
                      min="0"
                      value={
                        leagueDraft.forwardSlots
                      }
                      onChange={(
                        event,
                      ) =>
                        setLeagueDraft(
                          (
                            current,
                          ) => ({
                            ...current,

                            forwardSlots:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>
                </div>

                <div
                  style={{
                    display:
                      "grid",
                    gap: "10px",
                    marginTop:
                      "18px",
                  }}
                >
                  {leagueDraft.teams.map(
                    (
                      team,
                      index,
                    ) => (
                      <div
                        key={
                          team.id ??
                          `new-${index}`
                        }
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "1fr 120px auto",
                          gap: "8px",
                          alignItems:
                            "end",
                        }}
                      >
                        <label>
                          Squadra{" "}
                          {index +
                            1}

                          <input
                            type="text"
                            value={
                              team.name
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDraftTeam(
                                index,
                                "name",
                                event
                                  .target
                                  .value,
                              )
                            }
                          />
                        </label>

                        <label>
                          Crediti

                          <input
                            type="number"
                            min="1"
                            value={
                              team.startingCredits
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDraftTeam(
                                index,
                                "startingCredits",
                                event
                                  .target
                                  .value,
                              )
                            }
                          />
                        </label>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() =>
                            removeDraftTeam(
                              index,
                            )
                          }
                          disabled={
                            leagueDraft
                              .teams
                              .length <=
                            2
                          }
                        >
                          Rimuovi
                        </button>
                      </div>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  style={{
                    marginTop:
                      "12px",
                  }}
                  onClick={
                    addDraftTeam
                  }
                  disabled={
                    isSavingLeague
                  }
                >
                  + Aggiungi
                  squadra
                </button>

                <button
                  type="button"
                  className="assign-button"
                  style={{
                    marginTop:
                      "14px",
                  }}
                  onClick={() =>
                    void saveLeagueConfiguration()
                  }
                  disabled={
                    isSavingLeague
                  }
                >
                  {isSavingLeague
                    ? "Salvataggio..."
                    : "Salva configurazione"}
                </button>
              </section>

              <ListoneImport
                onImportComplete={
                  loadAuctionData
                }
              />

              <section
                style={{
                  marginTop:
                    "24px",
                  paddingTop:
                    "20px",
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
                    lineHeight:
                      1.5,
                  }}
                >
                  Cancella tutti
                  gli acquisti
                  registrati e
                  rende
                  nuovamente
                  disponibili
                  tutti i
                  giocatori. Il
                  Listone non
                  viene
                  modificato.
                </p>

                <button
                  type="button"
                  className="delete-button"
                  onClick={() =>
                    void resetAuction()
                  }
                  disabled={
                    isSaving
                  }
                >
                  Reset completo
                  asta
                </button>
              </section>
            </div>
          </section>
        </div>
      )}

      {session &&
        editingPurchase &&
        editingPlayer && (
          <div
            className="modal-backdrop"
            onClick={() => {
              if (
                !isSaving
              ) {
                setEditingPurchase(
                  null,
                );
              }
            }}
          >
            <section
              className="admin-modal"
              onClick={(
                event,
              ) =>
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