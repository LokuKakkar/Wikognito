import type { ReactNode } from "react";
import { DeskProp } from "../desk/DeskProp";

interface DossierProps {
  kicker?: string;
  title: string;
  titleId?: string;
  wide?: boolean;
  clip?: boolean;
  decor?: ReactNode;
  children: ReactNode;
}

/**
 * Secondary pages sit on a paper case file rather than a dark panel.
 * Optional clip and header art are decorative; titles stay in HTML.
 */
export function Dossier({
  kicker,
  title,
  titleId,
  wide = false,
  clip = true,
  decor,
  children,
}: DossierProps) {
  return (
    <div className={wide ? "dossier dossier-wide" : "dossier"}>
      {clip ? (
        <DeskProp
          className="dossier-clip"
          src="/assets/detective/objects/paperclips.png"
          width={106}
          height={140}
        />
      ) : null}
      <header className="dossier-head">
        <div className="dossier-titles">
          {kicker ? <p className="case-kicker">{kicker}</p> : null}
          <h1 id={titleId} className="page-title">
            {title}
          </h1>
        </div>
        {decor}
      </header>
      {children}
    </div>
  );
}
