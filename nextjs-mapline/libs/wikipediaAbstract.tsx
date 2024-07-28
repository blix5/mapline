import ReactDOM from "react-dom";
import React, { useState, useEffect } from "react";

const convertToApiUrl = (wikiUrl) => {
    const title = wikiUrl.split('/').pop();
    const encodedTitle = encodeURIComponent(title);
    return `https://en.wikipedia.org/w/api.php?action=query&origin=*&prop=extracts&format=json&exintro=&titles=${encodedTitle}`;
};

export const UrlToAbstract = ({ url, ...rest }) => {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();

  const extractAPIContents = json => {
    const { pages } = json.query;
    return Object.keys(pages).map(id => pages[id].extract);
  };

  const getContents = async () => {
    let resp;
    let contents = [];
    setLoading(true);
    try {
      resp = await fetch(convertToApiUrl(url));
      const json = await resp.json();
      contents = extractAPIContents(json);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    setContents(contents);
  };

  useEffect(() => {
    getContents();
  }, [url]);

  if (loading) return "Loading ...";
  if (error) return "An error occurred";
  return (
    <>
      {contents.map(content => (
        <p {...rest} dangerouslySetInnerHTML={{ __html: content }} />
      ))}
    </>
  );
};