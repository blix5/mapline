import { Html, Head, Main, NextScript } from 'next/document';

// This file did not exist, so Next emitted <html> with no lang attribute and screen
// readers fell back to the user's default voice.
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://en.wikipedia.org" />
        {/* The two faces that render immediately: the timeline labels and the nav. */}
        <link
          rel="preload"
          href="/futura/futura_medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/futura/futura_bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
