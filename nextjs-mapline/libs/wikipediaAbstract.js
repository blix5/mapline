import React, { useState, useEffect } from "react";

const convertToApiUrl = (wikiUrl) => {
  const title = decodeURIComponent(wikiUrl.split('/').pop());
  const encodedTitle = encodeURIComponent(title);
  return `https://en.wikipedia.org/w/api.php?action=query&origin=*&prop=extracts&format=json&exintro=&titles=${encodedTitle}`;
};

// Abstracts never change within a session, so re-opening a tab should not refetch.
const abstractCache = new Map();

const extractAPIContents = (json) => {
  const pages = json?.query?.pages ?? {};
  return Object.keys(pages).map((id) => pages[id].extract).filter(Boolean);
};

export default function UrlToAbstract({ url, ...rest }) {
  const [contents, setContents] = useState(() => abstractCache.get(url) ?? []);
  const [loading, setLoading] = useState(() => !!url && !abstractCache.has(url));
  const [error, setError] = useState();

  useEffect(() => {
    // Events without a wikiLink used to throw here, taking the info panel with them.
    if (!url) {
      setContents([]);
      setLoading(false);
      setError(undefined);
      return undefined;
    }

    if (abstractCache.has(url)) {
      setContents(abstractCache.get(url));
      setLoading(false);
      setError(undefined);
      return undefined;
    }

    // Without this, switching tabs quickly could let a slower earlier response
    // overwrite the abstract for the tab you are actually looking at.
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);

    fetch(convertToApiUrl(url), { signal: controller.signal })
      .then((response) => response.json())
      .then((json) => {
        const extracted = extractAPIContents(json);
        abstractCache.set(url, extracted);
        setContents(extracted);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err);
        setLoading(false);
      });

    return () => controller.abort();
  }, [url]);

  if (loading) return <p {...rest}>...</p>;
  if (error) return <p {...rest}>An error occurred: {error.message}</p>;

  return (
    <>
      {contents.map((content, index) => (
        <p key={index} {...rest} dangerouslySetInnerHTML={{ __html: content }} />
      ))}
    </>
  );
}
