import "./App.css";

type Team = {
  name: string;
  credits: number;
  players: number;
  goalkeeper: string;
  defenders: string;
  midfielders: string;
  attackers: string;
};

const teams: Team[] = [
  {
    name: "Scrotone",
    credits: 357,
    players: 13,
    goalkeeper: "3/3",
    defenders: "4/8",
    midfielders: "5/8",
    attackers: "1/6",
  },
  {
    name: "FC Mario",
    credits: 421,
    players: 11,
    goalkeeper: "2/3",
    defenders: "5/8",
    midfielders: "3/8",
    attackers: "1/6",
  },
  {
    name: "Dinamo",
    credits: 298,
    players: 15,
    goalkeeper: "3/3",
    defenders: "6/8",
    midfielders: "4/8",
    attackers: "2/6",
  },
  {
    name: "Atletico Barriera",
    credits: 389,
    players: 12,
    goalkeeper: "3/3",
    defenders: "4/8",
    midfielders: "4/8",
    attackers: "1/6",
  },
  {
    name: "Real Porta Palazzo",
    credits: 315,
    players: 14,
    goalkeeper: "3/3",
    defenders: "5/8",
    midfielders: "4/8",
    attackers: "2/6",
  },
  {
    name: "Sporting Dora",
    credits: 448,
    players: 9,
    goalkeeper: "2/3",
    defenders: "3/8",
    midfielders: "3/8",
    attackers: "1/6",
  },
  {
    name: "Borgo FC",
    credits: 276,
    players: 16,
    goalkeeper: "3/3",
    defenders: "6/8",
    midfielders: "5/8",
    attackers: "2/6",
  },
  {
    name: "San Salvario",
    credits: 402,
    players: 11,
    goalkeeper: "3/3",
    defenders: "4/8",
    midfielders: "3/8",
    attackers: "1/6",
  },
  {
    name: "Aurora 1912",
    credits: 334,
    players: 13,
    goalkeeper: "3/3",
    defenders: "5/8",
    midfielders: "4/8",
    attackers: "1/6",
  },
  {
    name: "Madama FC",
    credits: 365,
    players: 12,
    goalkeeper: "2/3",
    defenders: "4/8",
    midfielders: "4/8",
    attackers: "2/6",
  },
];

const recentPurchases = [
  {
    player: "Lautaro Martínez",
    team: "Scrotone",
    price: 143,
    role: "A",
  },
  {
    player: "Federico Dimarco",
    team: "FC Mario",
    price: 37,
    role: "D",
  },
  {
    player: "Riccardo Orsolini",
    team: "Dinamo",
    price: 42,
    role: "C",
  },
  {
    player: "Mile Svilar",
    team: "San Salvario",
    price: 18,
    role: "P",
  },
];

function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Asta Fantacalcio</p>
          <h1>FantAsta</h1>
        </div>

        <div className="topbar-actions">
          <button className="ghost-button">Modalità TV</button>
          <button className="primary-button">Admin</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-label">Ultimo acquisto</div>

          <div className="hero-content">
            <div>
              <div className="role-badge">A</div>

              <h2>Lautaro Martínez</h2>

              <p className="hero-team">Scrotone</p>
            </div>

            <div className="hero-price">
              <span>143</span>
              <small>crediti</small>
            </div>
          </div>
        </section>

        <section className="section-header">
          <div>
            <p className="eyebrow">Situazione live</p>
            <h3>Squadre</h3>
          </div>

          <div className="league-info">
            <span>10 squadre</span>
            <span>500 crediti iniziali</span>
          </div>
        </section>

        <section className="teams-grid">
          {teams.map((team) => (
            <article className="team-card" key={team.name}>
              <div className="team-card-header">
                <div>
                  <h4>{team.name}</h4>
                  <p>{team.players}/25 giocatori</p>
                </div>

                <div className="credits">
                  <strong>{team.credits}</strong>
                  <span>cr</span>
                </div>
              </div>

              <div className="roles">
                <div className="role-row">
                  <span>P</span>
                  <strong>{team.goalkeeper}</strong>
                </div>

                <div className="role-row">
                  <span>D</span>
                  <strong>{team.defenders}</strong>
                </div>

                <div className="role-row">
                  <span>C</span>
                  <strong>{team.midfielders}</strong>
                </div>

                <div className="role-row">
                  <span>A</span>
                  <strong>{team.attackers}</strong>
                </div>
              </div>

              <button className="team-button">Apri rosa</button>
            </article>
          ))}
        </section>

        <section className="recent-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Cronologia</p>
              <h3>Ultimi acquisti</h3>
            </div>
          </div>

          <div className="purchase-list">
            {recentPurchases.map((purchase) => (
              <div className="purchase-row" key={purchase.player}>
                <div className="purchase-player">
                  <div className="small-role">{purchase.role}</div>

                  <div>
                    <strong>{purchase.player}</strong>
                    <span>{purchase.team}</span>
                  </div>
                </div>

                <div className="purchase-price">
                  {purchase.price}
                  <span> cr</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;