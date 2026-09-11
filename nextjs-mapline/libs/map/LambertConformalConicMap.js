import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as d3 from 'd3';

import mapStyles from '../../styles/map/map.module.css';

// These ten datasets used to be `import`ed, which meant json-loader inlined ~28.6 MB of
// JSON into the page chunk, and the six geometry sets were then run through Douglas-Peucker
// synchronously at module scope — on the main thread, before React mounted. The simplified
// files are now precomputed by scripts/prepare-geojson.mjs and fetched per zoom tier.
const GEO = {
  lowLand: '/map/geojson/simplified/land_low.json',
  lowLake: '/map/geojson/simplified/lakes_low.json',
  lowRiver: '/map/geojson/simplified/rivers_low.json',
  mediumLand: '/map/geojson/simplified/land_medium.json',
  mediumLake: '/map/geojson/simplified/lakes_medium.json',
  mediumRiver: '/map/geojson/simplified/rivers_medium.json',
  mediumLabel: '/map/geojson/medium/labels_medium.geojson',
  mediumMarineLabel: '/map/geojson/medium/marine_labels_medium.geojson',
  highLabel: '/map/geojson/high/labels_high.geojson',
  highMarineLabel: '/map/geojson/high/marine_labels_high.geojson',
};

// One in-flight promise and one resolved value per URL, shared by every component
// instance, so crossing a zoom threshold repeatedly never refetches or reparses.
const geoRequests = new Map();
const geoResolved = new Map();

const loadGeoJson = (url) => {
  if (geoResolved.has(url)) return Promise.resolve(geoResolved.get(url));
  if (!geoRequests.has(url)) {
    geoRequests.set(url, fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        geoResolved.set(url, data);
        markReady();
        return data;
      })
      .catch((error) => {
        geoRequests.delete(url);
        throw error;
      }));
  }
  return geoRequests.get(url);
};

// The first paint shows an empty ocean until the medium tier lands (~1.1 MB gzipped,
// fetched after mount). This lets the page put something on screen in the meantime.
let firstTierResolved = false;
const readyListeners = new Set();
const markReady = () => {
  if (firstTierResolved) return;
  firstTierResolved = true;
  readyListeners.forEach((notify) => notify());
  readyListeners.clear();
};

export const useMapDataReady = () => {
  const [ready, setReady] = useState(firstTierResolved);
  useEffect(() => {
    if (firstTierResolved) {
      setReady(true);
      return undefined;
    }
    const notify = () => setReady(true);
    readyListeners.add(notify);
    return () => { readyListeners.delete(notify); };
  }, []);
  return ready;
};

const useGeoJson = (url) => {
  const [data, setData] = useState(() => geoResolved.get(url) ?? null);

  useEffect(() => {
    if (geoResolved.has(url)) {
      setData(geoResolved.get(url));
      return undefined;
    }
    let cancelled = false;
    loadGeoJson(url).then(
      (result) => { if (!cancelled) setData(result); },
      (error) => { console.error('Failed to load map data', error); },
    );
    return () => { cancelled = true; };
  }, [url]);

  return data;
};

const rotation = 95.65;

const getProjection = () => {
  return d3.geoConicConformal()
    .parallels([31, 48])
    .rotate([rotation, 0])
    .center([0, 36.5])
    .scale(2520)
    .translate([4051, 3874]);
};

const useProjection = () => useMemo(() => getProjection(), []);
const usePath = (projection) => useMemo(() => d3.geoPath().projection(projection), [projection]);

const renderPaths = (svg, data, path, className, opacity = () => 1) => {
  svg.selectAll(`.${className}`)
    .data(data.features, d => d.id)
    .join(
      enter => enter.append('path')
        .attr('d', path)
        .attr('class', className)
        .attr('opacity', opacity)
        .attr('stroke-width', d => (d.properties.strokeweig || 0.2) * 1.5),
      update => update
        .attr('d', path)
        .attr('opacity', opacity)
        .attr('stroke-width', d => (d.properties.strokeweig || 0.2) * 1.5),
      exit => exit.remove()
    );
};

const renderLabels = (svg, data, projection, className, fontSize = () => 10) => {
  svg.selectAll(`.${className}`)
    .data(data.features, d => d.id)
    .join(
      enter => enter.append('text')
        .attr('x', d => {
          const coordinates = d.geometry.type === 'Point' ? d.geometry.coordinates : d3.geoCentroid(d);
          return projection(coordinates)[0];
        })
        .attr('y', d => {
          const coordinates = d.geometry.type === 'Point' ? d.geometry.coordinates : d3.geoCentroid(d);
          return projection(coordinates)[1];
        })
        .attr('dy', '.35em')
        .attr('text-anchor', 'middle')
        .text(d => d.properties.label || d.properties.LABEL)
        .attr('font-size', `${fontSize}px`)
        .attr('class', className),
      update => update
        .attr('x', d => {
          const coordinates = d.geometry.type === 'Point' ? d.geometry.coordinates : d3.geoCentroid(d);
          return projection(coordinates)[0];
        })
        .attr('y', d => {
          const coordinates = d.geometry.type === 'Point' ? d.geometry.coordinates : d3.geoCentroid(d);
          return projection(coordinates)[1];
        })
        .attr('font-size', `${fontSize}px`),
      exit => exit.remove()
    );
};

export const LowProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const path = usePath(projection);
  const lowLandData = useGeoJson(GEO.lowLand);
  const lowLakeData = useGeoJson(GEO.lowLake);

  useEffect(() => {
    if (!lowLandData || !lowLakeData) return undefined;
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      renderPaths(svg, lowLandData, path, mapStyles.lccLand);
      renderPaths(svg, lowLakeData, path, mapStyles.lccWater);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [path, lowLandData, lowLakeData]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const LowTopProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const path = usePath(projection);
  const lowRiverData = useGeoJson(GEO.lowRiver);

  useEffect(() => {
    if (!lowRiverData) return undefined;
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      renderPaths(svg, lowRiverData, path, mapStyles.lccRiversLow);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [path, lowRiverData]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const MediumProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const path = usePath(projection);
  const mediumLandData = useGeoJson(GEO.mediumLand);
  const mediumLakeData = useGeoJson(GEO.mediumLake);

  useEffect(() => {
    if (!mediumLandData || !mediumLakeData) return undefined;
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      renderPaths(svg, mediumLandData, path, mapStyles.lccLand);
      renderPaths(svg, mediumLakeData, path, mapStyles.lccWater);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [path, mediumLandData, mediumLakeData]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const MediumTopProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const path = usePath(projection);
  const mediumRiverData = useGeoJson(GEO.mediumRiver);
  const mediumLakeData = useGeoJson(GEO.mediumLake);

  useEffect(() => {
    if (!mediumRiverData || !mediumLakeData) return undefined;
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      renderPaths(svg, mediumRiverData, path, mapStyles.lccRivers);

      renderPaths(svg, mediumLakeData, path, mapStyles.lccWater, 0.5);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [path, mediumRiverData, mediumLakeData]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const MediumTopLabelProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const mediumMarineLabelData = useGeoJson(GEO.mediumMarineLabel);
  const mediumLabelData = useGeoJson(GEO.mediumLabel);

  useEffect(() => {
    if (!mediumMarineLabelData || !mediumLabelData) return undefined;
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      renderLabels(svg, mediumMarineLabelData, projection, mapStyles.lccLabel, 8);
      renderLabels(svg, mediumLabelData, projection, mapStyles.lccLabel, 8);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [projection, mediumMarineLabelData, mediumLabelData]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const MediumTopRiverLabelProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const mediumRiverData = useGeoJson(GEO.mediumRiver);

  useEffect(() => {
    if (!mediumRiverData) return undefined;
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      renderLabels(svg, mediumRiverData, projection, mapStyles.lccRiverLabel);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [projection, mediumRiverData]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const HighTopLabelProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const path = usePath(projection);
  // 12.2 MB between them - only requested once the user actually zooms in this far.
  const highMarineLabelData = useGeoJson(GEO.highMarineLabel);
  const highLabelData = useGeoJson(GEO.highLabel);

  useEffect(() => {
    if (!highMarineLabelData || !highLabelData) return undefined;
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      renderLabels(svg, highMarineLabelData, projection, mapStyles.lccLabel, 6);
      renderLabels(svg, highLabelData, projection, mapStyles.lccLabel, 6);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [path, projection, highMarineLabelData, highLabelData]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

// Shared instance: these were building a whole new d3.geoConicConformal per call, and
// they are called six times per location per render.
const sharedProjection = getProjection();

export const latLonToX = (lat, lon) => sharedProjection([lon, lat])[0] - 2800;

export const latLonToY = (lat, lon) => sharedProjection([lon, lat])[1] - 3100;

/*const LambertConformalConicMapExport = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const downloadLinkRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    const projection = d3.geoConicConformal()
      .parallels([31, 48])
      .rotate([rotation, 0])
      .center([0, 36.5])
      .scale(2520)
      .translate([4051, 3874]);

    const path = d3.geoPath().projection(projection);

    // Clear previous SVG contents
    svg.selectAll("*").remove();

    // Draw the map
    svg.selectAll('path')
      .data(simplifiedData.features)
      .enter().append('path')
      .attr('d', path);

  }, []);

  const exportSVG = () => {
    console.log("Export SVG function called");
    const svgElement = svgRef.current;

    if (svgElement) {
      console.log("SVG element found");
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);
      console.log("SVG serialized to string");
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      console.log("Blob URL created", url);

      if (downloadLinkRef.current) {
        console.log("Download link found");
        downloadLinkRef.current.href = url;
        downloadLinkRef.current.download = "map.svg";
        downloadLinkRef.current.click();
        URL.revokeObjectURL(url);
        console.log("Download link clicked");
      } else {
        console.error("Download link not found.");
      }
    } else {
      console.error("SVG element not found.");
    }
  };

  return (
    <div>
      <svg ref={svgRef} width={width} height={height} {...rest}></svg>
      <a style={{zIndex:300}} ref={downloadLinkRef}>Download</a>
      <button style={{zIndex:300}} onClick={exportSVG}>Export as SVG</button>
    </div>
  );
};*/