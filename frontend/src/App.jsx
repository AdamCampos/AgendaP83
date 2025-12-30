import { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState("verificando...");
  const [funcionarios, setFuncionarios] = useState([]);

  useEffect(() => {
    fetch("/api/health")
      .then(r => r.json())
      .then(() => setStatus("Backend conectado ✅"))
      .catch(() => setStatus("Backend NÃO respondeu ❌"));

    fetch("/api/funcionarios")
      .then(r => r.json())
      .then(data => setFuncionarios(Array.isArray(data) ? data : []))
      .catch(() => setFuncionarios([]));
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "Arial" }}>
      <h1>Agenda P83</h1>

      <p><strong>Status:</strong> {status}</p>

      <h2>Funcionários</h2>

      {funcionarios.length === 0 ? (
        <p>(nenhum funcionário retornado)</p>
      ) : (
        <ul>
          {funcionarios.map((f, i) => (
            <li key={i}>{JSON.stringify(f)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
