import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

function getLocalHostUrl(port: number) {
  return `http://localhost:${port}`;
}

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [port, setPort] = useState<number | null>(null);

  useEffect(() => {
    console.log("Refresh", port);
    if (port) {
      return;
    }

    const unlisten = listen("oauth://url", (data) => {
      setPort(null);
      if (!data.payload) return;

      const url = new URL(data.payload as string);
      const code = new URLSearchParams(url.search).get("code");

      console.log("here", data.payload, code);
      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
          if (error) {
            alert(error.message);
            console.error(error);
            return;
          }
          location.reload();
        });
      }
    });

    let _port: number | null = null;
    invoke("plugin:oauth|start").then(async (port) => {
      setPort(port as number);
      _port = port as number;
    });

    () => {
      unlisten?.then((u) => u());
      invoke("plugin:oauth|cancel", { port: _port });
    };
  }, [port]);

  const handleProviderLogin = async (provider: "google" | "github") => {
    console.log("ho!~~~~");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithOAuth({
      options: {
        skipBrowserRedirect: true,
        scopes: provider === "google" ? "profile email" : "",
        redirectTo: getLocalHostUrl(port!),
      },
      provider: provider,
    });

    if (data.url) {
      openUrl(data.url).catch(console.error);
    } else {
      alert(error?.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            English Punch 🥊
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            매일 꾸준한 영어 학습
          </p>
        </div>
        <div>
          <button
            onClick={() => handleProviderLogin("google")}
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "로그인 중..." : "Google로 로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}
