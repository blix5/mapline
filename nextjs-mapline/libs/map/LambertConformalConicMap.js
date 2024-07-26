import React, { useRef, useMemo, useEffect } from 'react';
import * as d3 from 'd3';

import mapStyles from '../../styles/map/map.module.css';
const simplify = require('simplify-geojson');

import lowLandDataSrc from '../../public/map/geojson/low/land_low.geojson';
import mediumLandDataSrc from '../../public/map/geojson/medium/land_medium.geojson';
import lowLakeDataSrc from '../../public/map/geojson/low/lakes_low.geojson';
import mediumLakeDataSrc from '../../public/map/geojson/medium/lakes_medium.geojson';
import lowRiverDataSrc from '../../public/map/geojson/low/rivers_low.geojson';
import mediumRiverDataSrc from '../../public/map/geojson/medium/rivers_medium.geojson';
import mediumLabelDataSrc from '../../public/map/geojson/medium/labels_medium.geojson';
import highLabelDataSrc from '../../public/map/geojson/high/labels_high.geojson';
import mediumMarineLabelDataSrc from '../../public/map/geojson/medium/marine_labels_medium.geojson';
import highMarineLabelDataSrc from '../../public/map/geojson/high/marine_labels_high.geojson';

const simplifyData = (data, tolerance) => simplify(data, tolerance);

const lowLandData = simplifyData(lowLandDataSrc, 0.04);
const mediumLandData = simplifyData(mediumLandDataSrc, 0.02);

const lowLakeData = simplifyData(lowLakeDataSrc, 0.04);
const mediumLakeData = simplifyData(mediumLakeDataSrc, 0.02);

const lowRiverData = simplifyData(lowRiverDataSrc, 0.04)
const mediumRiverData = simplifyData(mediumRiverDataSrc, 0.02);

const mediumLabelData = simplifyData(mediumLabelDataSrc, 0.02);
const highLabelData = simplifyData(highLabelDataSrc, 0.01);

const mediumMarineLabelData = simplifyData(mediumMarineLabelDataSrc, 0.02);
const highMarineLabelData = simplifyData(highMarineLabelDataSrc, 0.01);

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

  useEffect(() => {
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      renderPaths(svg, lowLandData, path, mapStyles.lccLand);
      renderPaths(svg, lowLakeData, path, mapStyles.lccWater);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [path]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const LowTopProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const path = usePath(projection);

  useEffect(() => {
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      renderPaths(svg, lowRiverData, path, mapStyles.lccRiversLow);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [path]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const MediumProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const path = usePath(projection);

  useEffect(() => {
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      renderPaths(svg, mediumLandData, path, mapStyles.lccLand);
      renderPaths(svg, mediumLakeData, path, mapStyles.lccWater);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [path]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const MediumTopProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const path = usePath(projection);

  useEffect(() => {
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      renderPaths(svg, mediumRiverData, path, mapStyles.lccRivers);

      renderPaths(svg, mediumLakeData, path, mapStyles.lccWater, 0.5);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [path]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const MediumTopLabelProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();

  useEffect(() => {
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      renderLabels(svg, mediumMarineLabelData, projection, mapStyles.lccLabel, 8);
      renderLabels(svg, mediumLabelData, projection, mapStyles.lccLabel, 8);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [projection]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const MediumTopRiverLabelProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();

  useEffect(() => {
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      renderLabels(svg, mediumRiverData, projection, mapStyles.lccRiverLabel);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [projection]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const HighTopLabelProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);
  const projection = useProjection();
  const path = usePath(projection);

  useEffect(() => {
    const updateMap = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      renderLabels(svg, highMarineLabelData, projection, mapStyles.lccLabel, 6);
      renderLabels(svg, highLabelData, projection, mapStyles.lccLabel, 6);
    };

    const handle = requestAnimationFrame(updateMap);
    return () => cancelAnimationFrame(handle);
  }, [path, projection]);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const latLonToX = (lat, lon) => {
  const projection = getProjection();
  const [x] = projection([lon, lat]);
  return x - 2800;
};

export const latLonToY = (lat, lon) => {
  const projection = getProjection();
  const [, y] = projection([lon, lat]);
  return y - 3100;
};

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