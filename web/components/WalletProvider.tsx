"use client";
import { BrowserProvider } from "ethers";
import { createContext, useContext, useEffect, useState } from "react";
import { COSTON2 } from "@/lib/teeAbi";
type Wallet = { address: string; chainId: number; connecting: boolean; error: string; connect: () => Promise<void>; disconnect: () => void };
const WalletContext = createContext<Wallet>({ address:"", chainId:0, connecting:false, error:"", connect:async()=>{}, disconnect:()=>{} });
declare global { interface Window { ethereum?: { request: (args:{method:string; params?:unknown[]})=>Promise<unknown>; on?: (event:string, fn:(data:unknown)=>void)=>void } } }
export function WalletProvider({children}:{children:React.ReactNode}){const [address,setAddress]=useState("");const [chainId,setChainId]=useState(0);const [connecting,setConnecting]=useState(false);const [error,setError]=useState("");
useEffect(()=>{const eth=window.ethereum;if(!eth)return;eth.request({method:"eth_accounts"}).then(a=>{const accounts=a as string[];if(accounts[0])setAddress(accounts[0])});eth.request({method:"eth_chainId"}).then(id=>setChainId(Number(id)));eth.on?.("accountsChanged",a=>setAddress((a as string[])[0]||""));eth.on?.("chainChanged",id=>setChainId(Number(id)));},[]);
async function connect(){if(!window.ethereum){setError("MetaMask or a compatible EVM wallet is required.");return;}setConnecting(true);setError("");try{const provider=new BrowserProvider(window.ethereum);await provider.send("eth_requestAccounts",[]);let network=await provider.getNetwork();if(Number(network.chainId)!==COSTON2.chainId){try{await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x72"}]});}catch{await window.ethereum.request({method:"wallet_addEthereumChain",params:[{chainId:"0x72",chainName:COSTON2.chainName,nativeCurrency:COSTON2.nativeCurrency,rpcUrls:COSTON2.rpcUrls,blockExplorerUrls:COSTON2.blockExplorerUrls}]});}network=await provider.getNetwork();}const signer=await provider.getSigner();setAddress(await signer.getAddress());setChainId(Number(network.chainId));}catch(e){setError(e instanceof Error?e.message:"Wallet connection cancelled.");}finally{setConnecting(false)}}
return <WalletContext.Provider value={{address,chainId,connecting,error,connect,disconnect:()=>setAddress("")}}>{children}</WalletContext.Provider>}
export const useWallet=()=>useContext(WalletContext);
