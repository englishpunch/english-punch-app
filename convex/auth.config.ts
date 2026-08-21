import { MCP_RESOURCE, OAUTH_ISSUER } from "./oauthConfig";

const providers = [
  {
    domain: process.env.CONVEX_SITE_URL,
    applicationID: "convex",
  },
  {
    domain: OAUTH_ISSUER,
    applicationID: MCP_RESOURCE,
  },
];

export default { providers };
