module.exports = {
    webpack(config) {
        config.module.rules.push({
            test: /\.svg$/,
            //issuer: /\.[jt]sx?$/,
            use: [
                {
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
                },
            ]
        })

        return config
    },
}