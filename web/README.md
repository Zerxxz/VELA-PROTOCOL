# VELA Web (Next.js)

## Included
- Landing page: `/`
- Credit dashboard: `/dashboard`
- On-chain TEE Registry explorer: `/tee-registry`
- EIP-1193 wallet integration with `ethers.js` and automatic Coston2 network switching
- Persistent app-level dark/light mode toggle

## Run

```bash
cd web
cp .env.example .env.local
# Replace NEXT_PUBLIC_TEE_REGISTRY_ADDRESS with deploy.ts output
npm install
npm run dev
```

The TEE explorer performs a real read against Coston2 only after the deployed `VelaTeeRegistry` address is set in `.env.local`. No private keys are used by the browser.
