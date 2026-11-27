import { Eye, LockKeyhole, ShieldCheck } from "lucide-react";
import "../styles/SupervisorPreview.css";

type SupervisorPreviewProps = {
  title: string;
  description: string;
  unavailableActions: string[];
};

export default function SupervisorPreview({ title, description, unavailableActions }: SupervisorPreviewProps) {
  return <section className="supervisor-preview" aria-label={`Vista de supervisión: ${title}`}>
    <div className="supervisor-preview__icon"><Eye size={25} /></div>
    <div className="supervisor-preview__content">
      <span>ENTORNO DE DESARROLLO · SOLO SUPERVISIÓN</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="supervisor-preview__notice"><ShieldCheck size={18} /><p>No se cargaron datos reales protegidos ni se montaron formularios operativos en esta vista.</p></div>
      <div className="supervisor-preview__restricted"><LockKeyhole size={18} /><div><strong>Operaciones restringidas</strong><ul>{unavailableActions.map((action) => <li key={action}>{action}</li>)}</ul></div></div>
    </div>
  </section>;
}
