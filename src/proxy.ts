import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Permite que el sitio público y la página de preparación funcionen antes
  // de conectar el proyecto de Supabase.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        if (headers) {
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        }
      },
    },
  });

  // Verifica y renueva claims/cookies. La autorización se repite en la página
  // protegida y en cada Server Action; el proxy no es la única barrera.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
