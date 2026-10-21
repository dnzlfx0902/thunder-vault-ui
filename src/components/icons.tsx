import type { SVGProps } from "react";

const Icon = ({ children, ...props }: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
export const BoltIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" /></Icon>;
export const SearchIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Icon>;
export const FolderIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M3 6h7l2 2h9v10H3z"/></Icon>;
export const NoteIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 12h8M8 16h6"/></Icon>;
export const SendIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m3 11 18-8-8 18-2-8-8-2Z"/><path d="m11 13 10-10"/></Icon>;
export const MenuIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16"/></Icon>;
export const PanelIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M14 4v16"/></Icon>;
export const LinkIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></Icon>;
export const GraphIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><circle cx="5" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="m7 11 9-4M7 13l9 4"/></Icon>;
export const AttachIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m8 12 6-6a4 4 0 0 1 6 6l-8 8a6 6 0 0 1-8-8l8-8"/></Icon>;
export const DropletIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M12 2s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12Z"/></Icon>;
export const BrainIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v.55A3.5 3.5 0 0 0 4.5 8.5c0 .74.23 1.43.62 2A3.5 3.5 0 0 0 3 13.5 3.5 3.5 0 0 0 6.5 17H7v.5A2.5 2.5 0 0 0 9.5 20 2.5 2.5 0 0 0 12 17.5v-13A2.5 2.5 0 0 0 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 1 17 4.5v.55A3.5 3.5 0 0 1 19.5 8.5c0 .74-.23 1.43-.62 2A3.5 3.5 0 0 1 21 13.5 3.5 3.5 0 0 1 17.5 17H17v.5A2.5 2.5 0 0 1 14.5 20 2.5 2.5 0 0 1 12 17.5v-13A2.5 2.5 0 0 1 14.5 2Z"/></Icon>;
