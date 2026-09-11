import { useMemo, useState } from 'react';
import Layout from '../components/layout';
import { getSheetData } from '../libs/sheets';
import { dateFilterRender } from '../libs/dateFilterRender';
import { convertDateToDecimal } from '../libs/dateDecimal';
import utilStyles from '../styles/utils.module.css';
import styles from '../styles/sources.module.css';

// The College Board's nine periods. They deliberately overlap (5 ends 1877, 6 begins
// 1865), so an event is filed under the *earliest* period that contains it.
const PERIODS = [
  { key: 'pre', label: 'Before 1491', range: 'earliest records', from: -Infinity, to: 1491 },
  { key: '1', label: 'Period 1', range: '1491–1607', from: 1491, to: 1607 },
  { key: '2', label: 'Period 2', range: '1607–1754', from: 1607, to: 1754 },
  { key: '3', label: 'Period 3', range: '1754–1800', from: 1754, to: 1800 },
  { key: '4', label: 'Period 4', range: '1800–1848', from: 1800, to: 1848 },
  { key: '5', label: 'Period 5', range: '1844–1877', from: 1844, to: 1877 },
  { key: '6', label: 'Period 6', range: '1865–1898', from: 1865, to: 1898 },
  { key: '7', label: 'Period 7', range: '1890–1945', from: 1890, to: 1945 },
  { key: '8', label: 'Period 8', range: '1945–1980', from: 1945, to: 1980 },
  { key: '9', label: 'Period 9', range: '1980–present', from: 1980, to: Infinity },
];

export async function getStaticProps() {
  const { events } = await getSheetData();

  // slice(1) drops the sheet's header row, as on the timeline page.
  // Only serialisable fields go into props — `from`/`to` are ±Infinity sentinels used
  // for bucketing here and are deliberately not passed through.
  const buckets = PERIODS.map((p) => ({
    key: p.key, label: p.label, range: p.range, entries: [],
  }));

  events.slice(1).forEach((event) => {
    if (!event?.id) return;
    const decimal = convertDateToDecimal(event.startDate);
    const year = Number.isFinite(decimal) ? decimal : null;
    // Earliest containing period wins; anything undated falls in the last bucket.
    let index = PERIODS.findIndex((p) => year !== null && year >= p.from && year < p.to);
    if (index === -1) index = PERIODS.length - 1;
    buckets[index].entries.push({
      id: event.id,
      name: event.fullName || event.displayName,
      date: dateFilterRender(event.startDate, event.specStartDate) ?? '',
      category: event.category || 'event',
      wikiLink: event.wikiLink || null,
      sort: year ?? 0,
    });
  });

  buckets.forEach((b) => b.entries.sort((a, z) => a.sort - z.sort));

  return {
    props: {
      periods: buckets.filter((b) => b.entries.length > 0),
      total: buckets.reduce((n, b) => n + b.entries.length, 0),
      linked: buckets.reduce((n, b) => n + b.entries.filter((e) => e.wikiLink).length, 0),
    },
    revalidate: 300,
  };
}

export default function Sources({ periods, total, linked }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return periods;
    return periods
      .map((p) => ({ ...p, entries: p.entries.filter((e) => e.name.toLowerCase().includes(q)) }))
      .filter((p) => p.entries.length > 0);
  }, [periods, query]);

  const shown = filtered.reduce((n, p) => n + p.entries.length, 0);

  return (
    <Layout
      page="sources"
      title="Sources"
      description={`References for all ${total} events on the Mapline timeline, grouped by APUSH period.`}
    >
      <div className={styles.page}>
      <h1 className={utilStyles.headingXl}>Sources</h1>

      <p className={styles.intro}>
        Every event on the timeline with its reference. {linked} of {total} entries link to
        Wikipedia; the rest are listed without one. Grouped by the nine APUSH periods — these
        overlap by design, so each event is filed under the earliest period that contains it.
      </p>

      <div className={styles.controls}>
        <label className={utilStyles.srOnly} htmlFor="sources-filter">
          Filter sources by name
        </label>
        <input
          id="sources-filter"
          className={styles.filter}
          type="search"
          placeholder="Filter by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className={styles.count} aria-live="polite">
          {shown === total ? `${total} entries` : `${shown} of ${total}`}
        </span>
      </div>

      {filtered.length === 0 && <p className={styles.empty}>Nothing matches “{query}”.</p>}

      {filtered.map((period) => (
        <section key={period.key} className={styles.period}>
          <h2 className={styles.periodHeading}>
            {period.label}
            <span className={styles.periodRange}>{period.range}</span>
            <span className={styles.periodCount}>{period.entries.length}</span>
          </h2>
          <ul className={styles.list}>
            {period.entries.map((entry) => (
              <li key={entry.id} className={styles.entry}>
                <span
                  className={`${styles.chip} ${styles[`chip_${entry.category}`] || ''}`}
                  title={entry.category}
                >
                  {entry.category}
                </span>
                <span className={styles.name}>
                  {entry.wikiLink ? (
                    <a
                      className={utilStyles.inlineLink}
                      href={entry.wikiLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {entry.name}
                    </a>
                  ) : (
                    entry.name
                  )}
                </span>
                <span className={styles.date}>{entry.date}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className={styles.credits}>
        <h2 className={styles.periodHeading}>Map data</h2>
        <ul className={styles.creditList}>
          <li>Coastlines, lakes and rivers — Natural Earth (public domain).</li>
          <li>Historical state and territory boundaries — traced as SVG per year.</li>
          <li>Event summaries — Wikipedia, CC BY-SA.</li>
          {/* Add your textbook / class notes here. */}
        </ul>
      </section>
      </div>
    </Layout>
  );
}
