
# Hierarquia Completa de Funcionalidades e Subordinação

## 1. **Gerentes**
### GEPLAT (Gerente de Plataforma) e GEOP (Gerente de Operações)
Ambos os gerentes têm os mesmos subordinados diretos:

- **Subordinados**:
  - **COEMB (Coordenador de Embarcação)** - **Role**: COEMB (Usuário SQL: EK5H)
  - **COMAN (Coordenador de Manutenção)** - **Role**: COMAN (Usuário SQL: NSYD)
  - **COPROD (Coordenador de Produção)** - **Role**: COPROD (Usuário SQL: U4IC)
  - **Administrativo**:
    - **Engenheiros** - **Role**: ENG (Usuários SQL: U3PE, U3PX, BETN, B5QM, FETX)
    - **Administrativo** - **Role**: public (Usuário SQL: AJP2)

## 2. **Coordenadores**
### COEMB (Coordenador de Embarcação)
- **Subordinados**:
  - **SUEMB (Supervisor de Embarcação)** - **Role**: SUEMB (Usuários SQL: B1S8, YRAJ, RM4Y)

### COMAN (Coordenador de Manutenção)
- **Subordinados**:
  - **SUEIN (Supervisor de Elétrica e Instrumentação)** - **Role**: SUEIN (Usuários SQL: WVY4, FRCF, RWEU, YT3I)
  - **SUMEC (Supervisor de Mecânica)** - **Role**: SUMEC (Usuários SQL: SLDR, NSAZ, FRD9, MG0B)

### COPROD (Coordenador de Produção)
- **Subordinados**:
  - **SUPROD (Supervisor de Produção)** - **Role**: SUPROD (Usuários SQL: M37R, NA1Y, FRA2, KB1O, UREQ)

## 3. **Supervisores**
### SUEIN (Supervisor de Elétrica e Instrumentação)
- **Subordinados**:
  - **TMA (Técnico em Automação)** - **Role**: TMA (Usuários SQL: NVMJ, GMBD, URFA, URFB)
  - **TMI (Técnico em Instrumentação)** - **Role**: TMI (Usuários SQL: KEFZ, LMIN, EKID)
  - **TME (Técnico em Elétrica)** - **Role**: TME (Usuários SQL: E8FU, MAEV, NVR7, F9SG, F8ML, URFG)

### SUMEC (Supervisor de Mecânica)
- **Subordinados**:
  - **TMM (Técnico em Mecânica)** - **Role**: TMM (Usuários SQL: WMFR, PL7B, URP3, URNN)

### SUPROD (Supervisor de Produção)
- **Subordinados**:
  - **TO (Técnico de Operação - Produção)** - **Role**: TO_PRODUCAO (Usuários SQL: FW8J, AT7D, S24Y)

### SUEMB (Supervisor de Embarcação)
- **Subordinados**:
  - **TO (Técnico de Operação - Embarcação)** - **Role**: TO_EMBARCACAO (Usuários SQL: B0X1, AS4D, MCD1, LNIG)
  - **TLT (Técnico de Logística)** - **Role**: TLT (Usuário SQL: FW8J)

## 4. **Executantes**
### Técnicos (Linha mais baixa da hierarquia)
- **TMA** - Técnico em Automação - **Role**: TMA (Usuários SQL: NVMJ, GMBD, URFA)
- **TMI** - Técnico em Instrumentação - **Role**: TMI (Usuários SQL: KEFZ, LMIN, EKID)
- **TME** - Técnico em Elétrica - **Role**: TME (Usuários SQL: E8FU, MAEV, F9SG, F8ML)
- **TMM** - Técnico em Mecânica - **Role**: TMM (Usuários SQL: WMFR, PL7B, URP3, URNN)
- **TO (Técnicos de Operação)**:
  - **Operadores de Produção** (subordinados ao SUPROD) - **Role**: TO_PRODUCAO (Usuários SQL: FW8J, AT7D, S24Y)
  - **Operadores de Embarcação** (subordinados ao SUEMB) - **Role**: TO_EMBARCACAO (Usuários SQL: B0X1, AS4D, MCD1)
- **TLT** - Técnico de Logística (subordinado ao SUEMB) - **Role**: TLT (Usuário SQL: FW8J)

---

### Tabela de Roles Associados aos Funcionários

| **Funcionario**               | **Role SQL**   | **Chave** | **Função**     |
|-------------------------------|----------------|-----------|----------------|
| Maximina Giron                | TMM            | A1QB      | TMM            |
| Daiane Gomes Mota             | ADM            | AJP2      | ADM            |
| Filipe Nascimento Belmont     | COEMB          | EK5H      | COEMB          |
| Leandro de Avelar Ramalho     | COEMB          | UPDJ      | COEMB          |
| Rodrigo Cardoso Hespanhol     | COEMB          | U4XE      | COEMB          |
| Wilson Esguersoni Martins     | COEMB          | YMOF      | COEMB          |
| ...                           | ...            | ...       | ...            |

---

## **Explicação Didática da Interligação:**
A interligação entre **funcionário**, **role** e **usuário SQL** pode ser compreendida da seguinte maneira:

1. **Funcionar e Chave**: Cada **funcionário** tem uma **chave** única que corresponde ao nome do **usuário SQL** no banco de dados. A **chave** é o identificador que liga diretamente o **funcionário** à sua **função** no sistema.

2. **Função e Role**: A **função** de cada funcionário, como **TME**, **ENG**, **TO_P**, é associada a um **role** específico no banco de dados SQL. O **role** define as permissões que o funcionário possui dentro do banco de dados. Por exemplo:
   - O **role** **TME** permite ao técnico em elétrica acesso a operações específicas dentro da área de elétrica.
   - O **role** **ENG** é atribuído aos engenheiros, permitindo-lhes realizar tarefas técnicas relacionadas à engenharia.

3. **Usuário SQL e Role**: O **usuário SQL** é associado ao **role** específico. Este usuário tem permissões no banco de dados com base no **role** ao qual está associado. Isso garante que o **funcionário** tenha as permissões corretas para realizar suas atividades dentro do sistema.

4. **Hierarquia e Permissões**: A hierarquia é refletida pela relação entre **coordenadores**, **supervisores** e **executantes**, com cada nível recebendo permissões adequadas conforme sua função. As permissões no banco de dados são atribuídas com base nos **roles** que definem as áreas de acesso e as operações que cada usuário pode realizar.

Essa estrutura de interligação permite um controle granular sobre o acesso aos dados e operações dentro do sistema, garantindo que cada **funcionário** tenha as permissões necessárias para suas responsabilidades, e nada mais.
