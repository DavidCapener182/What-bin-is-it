import Head from 'expo-router/head';

const origin = 'https://what-bin-is-it-tonight.vercel.app';

export function RouteHead({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  const canonical = `${origin}${path}`;
  const fullTitle = `${title} | What Bin?`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="application-name" content="What Bin Is It Tonight?" />
      <meta name="description" content={description} />
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F3F4F0" />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#08212D" />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="What Bin Is It Tonight?" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={`${origin}/icon-512.png`} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${origin}/icon-512.png`} />
    </Head>
  );
}
