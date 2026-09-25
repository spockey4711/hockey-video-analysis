import { LegalDocument, LegalSectionBlock } from "./LegalDocument";
import {
  MissingOperatorNotice,
  OperatorAddress,
  OperatorContact,
} from "./OperatorDetails";
import { legalContent } from "./content";
import type { LegalOperator } from "./operator";

const { privacy } = legalContent;

/**
 * The Datenschutzerklärung body for the given operator: the controller block
 * from the operator's details, then the policy sections from the content layer.
 */
export function PrivacyPolicy({ operator }: { operator: LegalOperator }) {
  return (
    <LegalDocument title={privacy.title} subtitle={privacy.updated}>
      <MissingOperatorNotice operator={operator} />
      <LegalSectionBlock heading={privacy.controllerHeading}>
        <p>{privacy.controllerIntro}</p>
        <OperatorAddress operator={operator} />
        <OperatorContact operator={operator} />
      </LegalSectionBlock>
      {privacy.sections(operator.hostingProvider).map((section) => (
        <LegalSectionBlock key={section.id} heading={section.heading}>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.items && (
            <ul className="flex list-disc flex-col gap-[var(--space-1)] pl-[var(--space-6)]">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </LegalSectionBlock>
      ))}
    </LegalDocument>
  );
}
