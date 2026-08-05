import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  ogUrl?: string;
}

const OG_IMAGE_DEFAULT = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b811acaa-8045-4348-82f5-edcddf17b4cb/id-preview-2a007a5e--f5ca2e94-d59b-4f37-b504-8ed9835431bf.lovable.app-1775241871081.png";

export const SEOHead = ({
  title,
  description,
  keywords,
  canonical,
  ogType = "website",
  ogImage = OG_IMAGE_DEFAULT,
  ogUrl,
}: SEOHeadProps) => (
  <Helmet>
    <title>{title}</title>
    <meta name="description" content={description} />
    {keywords && <meta name="keywords" content={keywords} />}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content={ogType} />
    <meta property="og:image" content={ogImage} />
    {(ogUrl || canonical) && <meta property="og:url" content={ogUrl ?? canonical} />}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={ogImage} />
    {canonical && <link rel="canonical" href={canonical} />}
  </Helmet>
);
