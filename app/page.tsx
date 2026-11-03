import Link from "next/link";
import { HeatCurve } from "@/components/HeatCurve";
import { DIFFICULTIES, ROLE_GROUPS } from "@/lib/catalog";
import { Pressure } from "./Pressure";
import "./landing.css";

const SAMPLE_CURVE = [
  { label: "Q1", score: 74, detail: "Project depth" },
  { label: "Q2", score: 58, detail: "Trade-offs" },
  { label: "Q3", score: 66, detail: "Debugging" },
  { label: "Q4", score: 81, detail: "Ownership" },
  { label: "Q5", score: 61, detail: "System design" },
];

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="land-nav">
        <div className="land-nav__pill">
          <Link href="/" className="wordmark">Hotseat</Link>
          <nav className="land-nav__links" aria-label="Main">
            <a className="navlink" href="#how">How it works</a>
            <Link className="navlink" href="/learn">Learn</Link>
            <Link className="navlink" href="/history">History</Link>
            <Link className="btn" href="/setup">Start practising</Link>
          </nav>
        </div>
      </header>

      <main id="main" className="container">
        <section className="hero">
          <div>
            <h1>Take the heat before it counts.</h1>
            <p className="lead">A spoken mock interview built from your resume, with honest feedback.</p>
          </div>
          <form className="counter" action="/setup">
            <div className="field">
              <label className="field__label" htmlFor="hero-role">Role you are applying for</label>
              <input id="hero-role" name="role" className="input" list="hero-roles" autoComplete="off" placeholder="Backend Engineer" />
              <datalist id="hero-roles">
                {ROLE_GROUPS.flatMap((group) => group.roles).map((role) => <option key={role} value={role} />)}
              </datalist>
            </div>
            <fieldset className="dial">
              <legend>How hot?</legend>
              {DIFFICULTIES.map((level) => (
                <div className="choice" key={level.id}>
                  <input type="radio" name="difficulty" value={level.id} id={`hero-${level.id}`} defaultChecked={level.id === "medium"} />
                  <label htmlFor={`hero-${level.id}`}>
                    <span className={`heat-key heat-${level.heat}`} />
                    <span className="choice__title">{level.label}</span>
                  </label>
                </div>
              ))}
            </fieldset>
            <button type="submit" className="btn btn--primary btn--large">Take the seat</button>
          </form>
        </section>

        <section className="stage" id="how">
          <div className="stage__head">
            <h2>1. Bring your resume.</h2>
            <p>Upload it, or paste the job posting too. The questions come from your own work.</p>
          </div>
          <dl className="trace">
            <div className="trace__row"><dt>On a sample resume</dt><dd>Led the move from cron jobs to a queue.</dd></div>
            <div className="trace__row"><dt>The interviewer asks</dt><dd>What failed the first week after you moved to the queue?</dd></div>
          </dl>
        </section>

        <section className="stage">
          <div className="stage__head">
            <h2>2. Answer out loud.</h2>
            <p>The interviewer speaks, listens, then presses on what you said. Turn the heat up and it presses harder.</p>
          </div>
          <Pressure />
        </section>

        <section className="stage">
          <div className="stage__head">
            <h2>3. Read the debrief.</h2>
            <p>Every answer is scored against the level you chose, with pace, filler words and pauses measured from your recording.</p>
          </div>
          <div className="debrief">
            <div>
              <span className="figure">68</span>
              <p>Solid</p>
              <p className="debrief__note">A sample report, not a real result.</p>
            </div>
            <HeatCurve points={SAMPLE_CURVE} caption="Sample scores by question: 74, 58, 66, 81, 61" />
          </div>
        </section>

        <section className="stage">
          <div className="stage__head">
            <h2>4. Fix the answer.</h2>
            <p>The rewrite keeps your facts and tightens your story.</p>
          </div>
          <div className="compare">
            <figure>
              <figcaption>What a candidate said</figcaption>
              <blockquote>We had some performance issues, so I worked with the team and we made it a lot faster.</blockquote>
            </figure>
            <figure>
              <figcaption>The stronger version</figcaption>
              <blockquote>Checkout took 900 ms, so I traced it to repeat price lookups, added a cache, and brought it to 300 ms.</blockquote>
            </figure>
          </div>
        </section>

        <section className="stage">
          <div className="stage__head">
            <h2>Not ready for the seat?</h2>
            <p>Learn what your resume claims from the beginning. Hotseat builds a course from it, checks what you can explain, and tells you which lines you could not defend yet.</p>
          </div>
          <Link className="btn" href="/learn">Build a course</Link>
        </section>

        <section className="stage">
          <div className="stage__head"><h2>What you need</h2></div>
          <table className="needs">
            <tbody>
              <tr><th scope="row">A browser</th><td>Chrome or Edge add live captions.</td></tr>
              <tr><th scope="row">A microphone</th><td>Recommended, or type your answers.</td></tr>
              <tr><th scope="row">A camera</th><td>Optional. Video is never uploaded.</td></tr>
              <tr><th scope="row">An account</th><td>None. History stays on this device.</td></tr>
            </tbody>
          </table>
        </section>

        <section className="close">
          <h2>Five questions, about fifteen minutes.</h2>
          <Link className="btn btn--primary btn--large" href="/setup">Take the seat</Link>
        </section>
      </main>

      <footer className="mast container">
        <p className="mast__word">Hotseat</p>
        <nav className="mast__links" aria-label="Footer">
          <Link className="navlink" href="/setup">New interview</Link>
          <Link className="navlink" href="/learn">Learn</Link>
          <Link className="navlink" href="/history">History</Link>
          <Link className="navlink" href="/settings">Settings and privacy</Link>
        </nav>
      </footer>
    </>
  );
}
