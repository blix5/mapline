import React, { useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import worldData from '../public/map/geojson/land.geojson'; // Adjust the path to your data file

const simplify = require('simplify-geojson');

const tolerance = 0.02; // Adjust tolerance for desired simplification level
const simplifiedData = simplify(worldData, tolerance);

export const LambertConformalConicMap = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    // Define the Lambert Conformal Conic projection
    const projection = d3.geoConicConformal()
      .parallels([31, 48])
      .rotate([95.65, 0])
      .center([0, 36.5])
      .scale(2520)
      .translate([4051, 3874]);

    const path = d3.geoPath().projection(projection);

    // Draw the map
    svg.selectAll('path')
      .data(simplifiedData.features)
      .enter().append('path')
      .attr('d', path);

  }, []);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

const getLambertConformalProjection = () => {
  return d3.geoConicConformal()
    .parallels([31, 48])
    .rotate([95.65, 0])
    .center([0, 36.5])
    .scale(2520)
    .translate([4051, 3874]);
};
export const latLonToX = (lat, lon) => {
  const projection = getLambertConformalProjection();
  const [x, y] = projection([lon, lat]);
  return x - 2800;
}
export const latLonToY = (lat, lon) => {
  const projection = getLambertConformalProjection();
  const [x, y] = projection([lon, lat]);
  return y - 3100;
}

/*const LambertConformalConicMapExport = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const downloadLinkRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    const projection = d3.geoConicConformal()
      .parallels([31, 48])
      .rotate([95.65, 0])
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