module.exports = {
    webpack(config) {
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
        }, {
            test: /\.geojson$/,
            loader: 'json-loader'
        })

        return config
    },
}