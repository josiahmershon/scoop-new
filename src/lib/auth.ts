import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import ldap from "ldapjs";
import fs from "fs";
import path from "path";

const LDAP_URLS = [
  `ldaps://${process.env.LDAP_HOST_PRIMARY}:${process.env.LDAP_PORT || "636"}`,
  `ldaps://${process.env.LDAP_HOST_FAILOVER}:${process.env.LDAP_PORT || "636"}`,
];
const LDAP_BASE_DN = process.env.LDAP_BASE_DN || "DC=bluebell,DC=com";
const LDAP_BIND_DN = process.env.LDAP_BIND_DN || "";
const LDAP_BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD || "";

function getCACert(): Buffer | undefined {
  const certPath = process.env.LDAP_CA_CERT_PATH;
  if (certPath) {
    try {
      return fs.readFileSync(path.resolve(certPath));
    } catch (e) {
      console.error("Failed to load LDAP CA cert:", e);
    }
  }
  return undefined;
}

interface LDAPUser {
  username: string;
  displayName: string;
  email: string;
  groups: string[];
}

async function authenticateWithLDAP(username: string, password: string): Promise<LDAPUser | null> {
  const caCert = getCACert();

  for (const url of LDAP_URLS) {
    try {
      const user = await tryLDAPServer(url, username, password, caCert);
      if (user) return user;
    } catch (e) {
      console.error(`LDAP auth failed on ${url}:`, e);
      continue;
    }
  }
  return null;
}

function tryLDAPServer(
  url: string,
  username: string,
  password: string,
  caCert?: Buffer
): Promise<LDAPUser | null> {
  return new Promise((resolve, reject) => {
    const tlsOptions: Record<string, unknown> = { rejectUnauthorized: true };
    if (caCert) {
      tlsOptions.ca = [caCert];
    }

    const client = ldap.createClient({
      url,
      tlsOptions,
      connectTimeout: 10000,
    });

    client.on("error", (err: Error) => {
      client.destroy();
      reject(err);
    });

    client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD, (bindErr) => {
      if (bindErr) {
        client.destroy();
        reject(bindErr);
        return;
      }

      const filter = `(sAMAccountName=${username.replace(/[\\*()\0]/g, "")})`;

      client.search(LDAP_BASE_DN, {
        filter,
        scope: "sub",
        attributes: ["dn", "sAMAccountName", "displayName", "mail", "memberOf"],
      }, (searchErr, searchRes) => {
        if (searchErr) {
          client.destroy();
          reject(searchErr);
          return;
        }

        let userDN: string | null = null;
        let userAttrs: LDAPUser | null = null;

        searchRes.on("searchEntry", (entry) => {
          userDN = entry.dn.toString();
          const obj = (entry as unknown as Record<string, Record<string, unknown>>).ppiObject
            || (entry as unknown as Record<string, Record<string, unknown>>).object
            || {};

          const getAttr = (name: string): string => {
            const val = obj[name];
            if (Array.isArray(val)) return val[0] || "";
            return String(val || "");
          };

          const getAttrArray = (name: string): string[] => {
            const val = obj[name];
            if (Array.isArray(val)) return val;
            if (val) return [String(val)];
            return [];
          };

          userAttrs = {
            username: getAttr("sAMAccountName") || username,
            displayName: getAttr("displayName") || username,
            email: getAttr("mail") || "",
            groups: getAttrArray("memberOf").map((dn: string) => {
              const match = dn.match(/^CN=([^,]+)/i);
              return match ? match[1] : dn;
            }),
          };
        });

        searchRes.on("error", (err) => {
          client.destroy();
          reject(err);
        });

        searchRes.on("end", () => {
          if (!userDN || !userAttrs) {
            client.destroy();
            resolve(null);
            return;
          }

          client.bind(userDN, password, (userBindErr) => {
            client.destroy();
            if (userBindErr) {
              resolve(null);
              return;
            }
            resolve(userAttrs);
          });
        });
      });
    });
  });
}

function mapRole(groups: string[]): string {
  const groupNames = groups.map((g) => g.toLowerCase());
  if (groupNames.some((g) => g.includes("it-staff") || g.includes("it staff"))) return "it_admin";
  if (groupNames.some((g) => g.includes("officemgr") || g.includes("office manager"))) return "office_manager";
  if (groupNames.some((g) => g.includes("sales-rep") || g.includes("sales rep"))) return "sales_rep";
  if (groupNames.some((g) => g.includes("rsr"))) return "rsr";
  return "general";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Blue Bell Active Directory",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = String(credentials.username);
        const password = String(credentials.password);

        const ldapUser = await authenticateWithLDAP(username, password);
        if (!ldapUser) return null;

        return {
          id: `bb-${ldapUser.username}`,
          name: ldapUser.displayName,
          email: ldapUser.email,
          role: mapRole(ldapUser.groups),
          groups: ldapUser.groups,
          username: ldapUser.username,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        token.role = u.role;
        token.groups = u.groups;
        token.username = u.username;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const s = session.user as unknown as Record<string, unknown>;
        s.id = token.sub;
        s.role = token.role;
        s.groups = token.groups;
        s.username = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
