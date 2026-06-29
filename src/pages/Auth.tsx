import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Webhook } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// O Supabase Auth exige email; convertemos o nick num email interno fixo.
// O usuário só vê/usa o nome de usuário — nunca um email.
const nickToEmail = (nick: string) =>
  `${nick.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@payhook.app`;

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (clean.length < 3) {
      toast({
        title: "Nome de usuário inválido",
        description: "Use ao menos 3 caracteres (letras, números, . _ -).",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const email = nickToEmail(clean);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Erro ao entrar", description: "Usuário ou senha incorretos.", variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        const msg = /already registered|already exists/i.test(error.message)
          ? "Esse nome de usuário já existe."
          : error.message;
        toast({ title: "Erro ao cadastrar", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Conta criada!", description: "Bem-vindo ao PayHook." });
        navigate("/");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary glow-primary">
            <Webhook className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">PayHook</h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-4 rounded-xl p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nome de usuário</label>
            <input
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="seunick"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Aguarde..." : isLogin ? "Entrar" : "Cadastrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
            {isLogin ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}
