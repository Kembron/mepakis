"use client"

import type * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { type ButtonProps, buttonVariants } from "@/components/ui/button"

export interface PaginationProps extends React.ComponentProps<"nav"> {
  totalPages: number
  currentPage: number
  onPageChange: (page: number) => void
  siblingCount?: number
  className?: string
}

export function Pagination({
  totalPages,
  currentPage,
  onPageChange,
  siblingCount = 1,
  className,
  ...props
}: PaginationProps) {
  // Función para generar el rango de páginas
  const generatePaginationRange = () => {
    // Siempre mostrar la primera página
    const firstPageIndex = 1
    // Siempre mostrar la última página
    const lastPageIndex = totalPages

    // Calcular el rango de páginas a mostrar
    const startPage = Math.max(1, currentPage - siblingCount)
    const endPage = Math.min(totalPages, currentPage + siblingCount)

    // Inicializar el array de páginas
    const range: (number | "dots")[] = []

    // Añadir la primera página si no está incluida en el rango
    if (startPage > firstPageIndex) {
      range.push(firstPageIndex)
      // Añadir puntos suspensivos si hay un salto
      if (startPage > firstPageIndex + 1) {
        range.push("dots")
      }
    }

    // Añadir el rango de páginas
    for (let i = startPage; i <= endPage; i++) {
      range.push(i)
    }

    // Añadir la última página si no está incluida en el rango
    if (endPage < lastPageIndex) {
      // Añadir puntos suspensivos si hay un salto
      if (endPage < lastPageIndex - 1) {
        range.push("dots")
      }
      range.push(lastPageIndex)
    }

    return range
  }

  const paginationRange = generatePaginationRange()

  // Si solo hay una página, no mostrar la paginación
  if (totalPages <= 1) {
    return null
  }

  return (
    <nav
      role="navigation"
      aria-label="Paginación"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    >
      <ul className="flex flex-row items-center gap-1">
        {/* Botón anterior */}
        <PaginationItem
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Ir a la página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Anterior</span>
        </PaginationItem>

        {/* Páginas */}
        {paginationRange.map((pageNumber, i) =>
          pageNumber === "dots" ? (
            <PaginationEllipsis key={`ellipsis-${i}`} />
          ) : (
            <PaginationLink
              key={pageNumber}
              isActive={pageNumber === currentPage}
              onClick={() => onPageChange(pageNumber)}
              aria-label={`Ir a la página ${pageNumber}`}
              aria-current={pageNumber === currentPage ? "page" : undefined}
            >
              {pageNumber}
            </PaginationLink>
          ),
        )}

        {/* Botón siguiente */}
        <PaginationItem
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Ir a la página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Siguiente</span>
        </PaginationItem>
      </ul>
    </nav>
  )
}

export interface PaginationItemProps extends React.ComponentProps<"li"> {}

export function PaginationItem({ className, ...props }: PaginationItemProps) {
  return <li className={cn("", className)} {...props} />
}

export interface PaginationLinkProps extends React.ComponentProps<"button">, Pick<ButtonProps, "size"> {
  isActive?: boolean
}

export function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  return (
    <PaginationItem>
      <button
        aria-current={isActive ? "page" : undefined}
        className={cn(
          buttonVariants({
            variant: isActive ? "outline" : "ghost",
            size,
          }),
          isActive && "pointer-events-none",
          className,
        )}
        {...props}
      />
    </PaginationItem>
  )
}

export function PaginationEllipsis({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <PaginationItem className={cn("flex h-9 w-9 items-center justify-center", className)} {...props}>
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">Más páginas</span>
    </PaginationItem>
  )
}

export interface PaginationContentProps extends React.ComponentProps<"ul"> {}

export function PaginationContent({ className, ...props }: PaginationContentProps) {
  return <ul className={cn("flex items-center justify-center gap-1", className)} {...props} />
}

export interface PaginationPreviousProps extends React.ComponentProps<"a"> {}

export function PaginationPrevious({ className, ...props }: PaginationPreviousProps) {
  return (
    <a
      className={cn(
        "inline-flex items-center justify-center h-8 gap-1 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-gray-100",
        className,
      )}
      {...props}
    >
      <ChevronLeft className="w-4 h-4" />
      <span>Previous</span>
    </a>
  )
}

export interface PaginationNextProps extends React.ComponentProps<"a"> {}

export function PaginationNext({ className, ...props }: PaginationNextProps) {
  return (
    <a
      className={cn(
        "inline-flex items-center justify-center h-8 gap-1 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-gray-100",
        className,
      )}
      {...props}
    >
      <span>Next</span>
      <ChevronRight className="w-4 h-4" />
    </a>
  )
}
