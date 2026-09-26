import { CLI_RESOURCE, MCP_RESOURCE, OAUTH_ISSUER } from "./oauthConfig";

const providers = [
  {
    domain: process.env.CONVEX_SITE_URL,
    applicationID: "convex",
  },
  {
    domain: OAUTH_ISSUER,
    applicationID: MCP_RESOURCE,
  },
  {
    domain: OAUTH_ISSUER,
    applicationID: CLI_RESOURCE,
  },
];

export default { providers };
