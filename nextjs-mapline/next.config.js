module.exports = {
    compiler: {
        // styled-components is used but was never wired into the SWC transform, so
        // class names did not match between server and client.
        styledComponents: true,
    },
    webpack(config) {
        // NOTE: the `json-loader` rule for *.geojson was removed deliberately. It inlined
        // ~28.6 MB of GeoJSON into the page bundle. Map data is fetched at runtime now —
        // see libs/map/LambertConformalConicMap.js and scripts/prepare-geojson.mjs.
        config.module.rules.push({
            test: /\.svg$/,
            use: [{
                loader: require.resolve('@svgr/webpack'),
                options: {
                    prettier: false,
                    svgo: false,
                    svgoConfig: {
                        plugins: [{ removeViewBox: false }],
                    },
                    titleProp: true,
                    ref: true,
                },
            }]
        })

        return config
    },
}
