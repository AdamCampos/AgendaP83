import { useEffect, useState } from "react";

export default function App() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    fetch("/api/funcionarios")
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw data;
        return data;
      })
      .then(data => {
        setFuncionarios(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error("Erro funcionários:", err);
        setErro("Erro ao carregar funcionários");
        setFuncionarios([]);
      });
  }, []);

  if (erro) {
    return <div style={{ padding: 20, color: "red" }}>{erro}</div>;
  }

  return (
    <div>
      <h1>Agenda P-83</h1>

      <table>
        <tbody>
          {funcionarios.map(f => (
            <tr key={f.Chave}>
              <td>{f.Matricula}</td>
              <td>{f.Nome}</td>
              <td>{f.Chave}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
