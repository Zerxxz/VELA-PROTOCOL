import type { Metadata } from "next";import "./globals.css";import { WalletProvider } from "@/components/WalletProvider";
export const metadata:Metadata={title:"VELA — Private Credit",description:"Confidential credit infrastructure on Flare"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" data-theme="dark"><body><WalletProvider>{children}</WalletProvider></body></html>}
