// ============================================
// BiblioGest - Logotipo da aplicação
// Inline em SVG: sem dependência de arquivo,
// nítido em qualquer tamanho e cor.
// ============================================

export default function BiblioGestLogo({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="BiblioGest"
    >
      {/* livro aberto */}
      <path
        d="M24 13.5C20.9 11.4 17.1 10.5 12 10.5c-1.9 0-3.5.2-4.5.4v26.4c1-.2 2.6-.4 4.5-.4 5.1 0 8.9.9 12 3 3.1-2.1 6.9-3 12-3 1.9 0 3.5.2 4.5.4V10.9c-1-.2-2.6-.4-4.5-.4-5.1 0-8.9.9-12 3Z"
        fill="#2563EB"
      />
      {/* linha central do livro */}
      <path d="M24 13.5v26.4" stroke="#DBEAFE" strokeWidth="1.6" />
      {/* linhas de texto nas páginas */}
      <path
        d="M16 20.5h5M16 25h5M16 29.5h3.5M27 20.5h5M27 25h5M27 29.5h3.5"
        stroke="#DBEAFE"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
