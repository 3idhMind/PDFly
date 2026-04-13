import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogType?: string;
}

export const SEOHead = ({ title, description, keywords, canonical, ogType = "website" }: SEOHeadProps) => (
  <Helmet>
    <title>{title}</title>
    <meta name="description" content={description} />
    {keywords && <meta name="keywords" content={keywords} />}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content={ogType} />
    {canonical && <meta property="og:url" content={canonical} />}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    {canonical && <link rel="canonical" href={canonical} />}
  </Helmet>
);
