import React, { useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import ogLandData from '../../public/map/geojson/land.geojson';
import ogWaterData from '../../public/map/geojson/lakes.geojson';
import labelData from '../../public/map/geojson/labels.geojson';
import elevationPointData from '../../public/map/geojson/elevation_points.geojson';
import marineLabelData from '../../public/map/geojson/marine_labels.geojson';
import regionPointData from '../../public/map/geojson/region_points.geojson';
import riverData from '../../public/map/geojson/rivers.geojson';

import mapStyles from '../../styles/map/map.module.css';

const simplify = require('simplify-geojson');

const rotation = 95.65;
const tolerance = 0.02;
const landData = simplify(ogLandData, tolerance);
const waterData = simplify(ogWaterData, tolerance);

export const LandProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    const projection = d3.geoConicConformal()
      .parallels([31, 48])
      .rotate([rotation, 0])
      .center([0, 36.5])
      .scale(2520)
      .translate([4051, 3874]);

    const path = d3.geoPath().projection(projection);
    svg.selectAll("*").remove();

    svg.selectAll(`.${mapStyles.lccLand}`)
      .data(landData.features)
      .enter().append('path')
      .attr('d', path)
      .attr('class', mapStyles.lccLand);

    svg.selectAll(`.${mapStyles.lccWater}`)
      .data(waterData.features)
      .enter().append('path')
      .attr('d', path)
      .attr('class', mapStyles.lccWater);

  }, []);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const LabelProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    const projection = d3.geoConicConformal()
      .parallels([31, 48])
      .rotate([rotation, 0])
      .center([0, 36.5])
      .scale(2520)
      .translate([4051, 3874]);

    const path = d3.geoPath().projection(projection);
    svg.selectAll("*").remove();

    svg.selectAll(`.${mapStyles.lccWater}`)
      .data(waterData.features)
      .enter().append('path')
      .attr('d', path)
      .attr('opacity', 0.4)
      .attr('class', mapStyles.lccWater);

    svg.selectAll(`.${mapStyles.lccRivers}`)
      .data(riverData.features)
      .enter().append('path')
      .attr('d', path)
      .attr('stroke-width', d => (d.properties.strokeweig || 0.2) * 1.5)
      .attr('opacity', 0.6)
      .attr('class', mapStyles.lccRivers);

    svg.selectAll(`.${mapStyles.lccLabel}`)
      .data(marineLabelData.features)
      .enter().append('text')
      .attr('x', d => {
        const coordinates = d.geometry.type === 'Point'
          ? d.geometry.coordinates
          : d3.geoCentroid(d);
        return projection(coordinates)[0];
      })
      .attr('y', d => {
        const coordinates = d.geometry.type === 'Point'
          ? d.geometry.coordinates
          : d3.geoCentroid(d);
        return projection(coordinates)[1];
      })
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .text(d => d.properties.label)
      .attr('class', mapStyles.lccLabel);

    svg.selectAll(`.${mapStyles.lccLabel}`)
      .data(labelData.features)
      .enter().append('text')
      .attr('x', d => {
        const coordinates = d.geometry.type === 'Point'
          ? d.geometry.coordinates
          : d3.geoCentroid(d);
        return projection(coordinates)[0];
      })
      .attr('y', d => {
        const coordinates = d.geometry.type === 'Point'
          ? d.geometry.coordinates
          : d3.geoCentroid(d);
        return projection(coordinates)[1];
      })
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .text(d => d.properties.LABEL)
      .attr('class', mapStyles.lccLabel);

  }, []);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

export const RiverLabelProjectionLCC = ({ width, height, ...rest }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    const projection = d3.geoConicConformal()
      .parallels([31, 48])
      .rotate([rotation, 0])
      .center([0, 36.5])
      .scale(2520)
      .translate([4051, 3874]);

    const path = d3.geoPath().projection(projection);
    svg.selectAll("*").remove();

    svg.selectAll(`.${mapStyles.lccRiverLabel}`)
      .data(riverData.features)
      .enter().append('text')
      .attr('x', d => {
        const coordinates = d.geometry.type === 'Point'
          ? d.geometry.coordinates
          : d3.geoCentroid(d);
        return projection(coordinates)[0];
      })
      .attr('y', d => {
        const coordinates = d.geometry.type === 'Point'
          ? d.geometry.coordinates
          : d3.geoCentroid(d);
        return projection(coordinates)[1];
      })
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .text(d => d.properties.label)
      .attr('class', mapStyles.lccRiverLabel);

  }, []);

  return <svg ref={svgRef} width={width} height={height} {...rest}></svg>;
};

const getLCCProjection = () => {
  return d3.geoConicConformal()
    .parallels([31, 48])
    .rotate([rotation, 0])
    .center([0, 36.5])
    .scale(2520)
    .translate([4051, 3874]);
};
export const latLonToX = (lat, lon) => {
  const projection = getLCCProjection();
  const [x, y] = projection([lon, lat]);
  return x - 2800;
}
export const latLonToY = (lat, lon) => {
  const projection = getLCCProjection();
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