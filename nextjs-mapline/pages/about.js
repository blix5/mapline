import Layout from '../components/layout';
import utilStyles from '../styles/utils.module.css';
import styles from '../styles/about.module.css';

export default function About() {
  return (
    <Layout
      page="about"
      title="About"
      description="What Mapline is, and how to use the map and timeline together."
    >
      <div className={styles.aboutPage}>
      <h1 className={utilStyles.headingXl}>
        History, now in time <em>and</em> space.
      </h1>

      <p className={styles.lede}>
        Mapline is a map and timeline of United States history, built as a study tool for
        APUSH. Scrolling the timeline moves the map with it, so you can see not just when
        something happened but where — and what the country looked like at the time.
      </p>

      <section className={styles.section}>
        <h2 className={styles.heading}>How it works</h2>
        <p>
          The two halves are linked. As you scroll the timeline, the map redraws to the year
          under the marker: state and territory borders change, and pins appear for the
          places tied to events in view. Drag the bar between them to give either half more
          room.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Getting around</h2>
        <dl className={styles.keys}>
          <dt>Scroll the timeline</dt>
          <dd>Horizontally to move through time, vertically to move between categories.</dd>

          <dt>Zoom slider</dt>
          <dd>On the left of the timeline. Zooming in spreads years apart and reveals more
            detail; zooming out gives you the shape of a whole era.</dd>

          <dt>Search</dt>
          <dd>Top right. Enter jumps to the closest match.</dd>

          <dt>Year box</dt>
          <dd>Under the marker at the bottom. Type a year or a full date and press Enter to
            jump straight there.</dd>

          <dt>The map</dt>
          <dd>Drag to pan, scroll to zoom. Zooming in far enough brings in rivers, lakes and
            place labels.</dd>

          <dt>Pins</dt>
          <dd>A numbered pin means several events share that location — click it to see the
            list.</dd>

          <dt>Events</dt>
          <dd>Click one to open it. It stays open as a tab, so you can line several up and
            switch between them. An arrow on an event means it has related events nested
            underneath.</dd>
        </dl>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Reading the colours</h2>
        <p>
          Each horizontal band is a category — events, legislation, foreign affairs, works,
          court cases, trends and administrations — and each has its own colour. The small
          icon on a card is its theme: battle, economic, social, territorial and so on. Wider
          bars spanning many years are periods and movements rather than single moments.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Where the information comes from</h2>
        <p>
          Events are compiled from class notes and cross-checked against Wikipedia, which is
          also where each event&apos;s summary is pulled from when you open it. The full list
          with references is on the{' '}
          <a className={utilStyles.inlineLink} href="/sources">
            sources
          </a>{' '}
          page.
        </p>
        <p className={styles.note}>
          Still a work in progress — events are being added and corrected as I go.
        </p>
      </section>
      </div>
    </Layout>
  );
}
