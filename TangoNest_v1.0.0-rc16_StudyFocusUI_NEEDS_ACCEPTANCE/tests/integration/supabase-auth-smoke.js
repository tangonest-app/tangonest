const fs = require("fs");
const path = require("path");

const appDir = path.resolve(__dirname, "../..");
const configSource = fs.readFileSync(path.join(appDir, "config.js"), "utf8");

function configValue(name){
  const match = configSource.match(new RegExp(`${name}:\"([^\"]+)\"`));
  return match?.[1] || "";
}

const baseUrl = process.env.TN_SUPABASE_URL || configValue("supabaseUrl");
const publishableKey = process.env.TN_SUPABASE_KEY || configValue("supabasePublishableKey");
const email = String(process.env.TN_TEST_EMAIL || "").trim();
const password = String(process.env.TN_TEST_PASSWORD || "");

if(!baseUrl || !publishableKey || !email || !password){
  console.error("Set TN_TEST_EMAIL and TN_TEST_PASSWORD before running the real Supabase smoke test.");
  process.exit(2);
}

async function request(pathname,{token,body,method="GET"}={}){
  const response = await fetch(`${baseUrl}${pathname}`,{
    method,
    headers:{
      apikey:publishableKey,
      Authorization:`Bearer ${token || publishableKey}`,
      ...(body ? {"Content-Type":"application/json"} : {})
    },
    body:body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data = null;
  try{ data = text ? JSON.parse(text) : null; }catch(error){ data = text; }
  return {status:response.status,ok:response.ok,data};
}

async function passwordLogin(loginPassword){
  return request("/auth/v1/token?grant_type=password",{
    method:"POST",
    body:{email,password:loginPassword}
  });
}

async function main(){
  const checks = {};

  const wrong = await passwordLogin(`${password}-intentionally-wrong`);
  checks.wrongPasswordRejected = wrong.status === 400 && wrong.data?.error_code === "invalid_credentials";

  const login = await passwordLogin(password);
  checks.existingLogin = login.ok && !!login.data?.access_token && !!login.data?.refresh_token;
  if(!checks.existingLogin)throw new Error(`Existing login failed with HTTP ${login.status}`);

  const accessToken = login.data.access_token;
  const playlists = await request("/rest/v1/tn_playlists?select=id,name,user_id&limit=1",{token:accessToken});
  const words = await request("/rest/v1/tn_words?select=id,front,position,user_id&limit=1",{token:accessToken});
  checks.tnPlaylists = {ok:playlists.ok,status:playlists.status};
  checks.tnWords = {ok:words.ok,status:words.status};

  const refresh = await request("/auth/v1/token?grant_type=refresh_token",{
    method:"POST",
    body:{refresh_token:login.data.refresh_token}
  });
  checks.sessionRefresh = refresh.ok && !!refresh.data?.access_token && !!refresh.data?.refresh_token;

  const logoutToken = refresh.data?.access_token || accessToken;
  const logout = await request("/auth/v1/logout",{method:"POST",token:logoutToken});
  checks.logout = logout.ok;

  const relogin = await passwordLogin(password);
  checks.relogin = relogin.ok && !!relogin.data?.access_token;

  console.log(JSON.stringify(checks,null,2));

  const passed = checks.wrongPasswordRejected
    && checks.existingLogin
    && checks.tnPlaylists.ok
    && checks.tnWords.ok
    && checks.sessionRefresh
    && checks.logout
    && checks.relogin;
  if(!passed)process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
