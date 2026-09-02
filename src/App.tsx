import {
  useCallback,
  useEffect,
  useMemo,
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

  const [
    lastPurchase,
    setLastPurchase,
  ] = useState<{
    player: Player;
    teamName: string;
  } | null>(null);

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

              const teamPlayers =
                teamPurchases
                  .map(
                    (
                      purchase,
                    ) => {
                      const player =
                        mappedPlayers.find(
                          (
                            candidate,
                          ) =>
                            candidate.id ===
                            purchase.player_id,
                        );

                      if (
                        !player
                      ) {
                        return null;
                      }

                      return {
                        ...player,
                        price:
                          purchase.price,
                      };
                    },
                  )
                  .filter(
                    (
                      player,
                    ): player is Player =>
                      player !==
                      null,
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

        const latestPurchase =
          databasePurchases.length >
          0
            ? databasePurchases[
                databasePurchases.length -
                  1
              ]
            : null;

        if (
          latestPurchase
        ) {
          const player =
            mappedPlayers.find(
              (
                candidate,
              ) =>
                candidate.id ===
                latestPurchase.player_id,
            );

          const team =
            mappedTeams.find(
              (
                candidate,
              ) =>
                candidate.id ===
                latestPurchase.team_id,
            );

          if (
            player &&
            team
          ) {
            setLastPurchase(
              {
                player: {
                  ...player,
                  price:
                    latestPurchase.price,
                },

                teamName:
                  team.name,
              },
            );
          } else {
            setLastPurchase(
              null,
            );
          }
        } else {
          setLastPurchase(
            null,
          );
        }

        setIsLoading(
          false,
        );
      },
      [],
    );

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
    setSelectedPlayerId(
      null,
    );

    setPlayerSearch("");
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

  return (
    <div className="auction-app">
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
          <button className="secondary-button">
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

                  {lastPurchase
                    .player
                    .quotation !=
                    null &&
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
                  Admin per
                  registrare il
                  primo acquisto.
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

                        <h2>
                          {
                            team.name
                          }
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