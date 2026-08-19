import { ChatIcon, ReturnIcon, ShieldIcon, TruckIcon } from './icons';

export interface TrustItem {
  title: string;
  description: string;
  icon: 'shipping' | 'secure' | 'returns' | 'support';
}

const ICONS = {
  shipping: TruckIcon,
  secure: ShieldIcon,
  returns: ReturnIcon,
  support: ChatIcon,
} as const;

export const DEFAULT_TRUST_ITEMS: TrustItem[] = [
  { icon: 'shipping', title: 'Envío gratis', description: 'En pedidos +$50' },
  { icon: 'secure', title: 'Pago seguro', description: 'Cifrado de extremo a extremo' },
  { icon: 'returns', title: 'Devoluciones fáciles', description: '30 días para cambios' },
  { icon: 'support', title: 'Soporte 24/7', description: 'Estamos para ayudarte' },
];

export function TrustBar({ items = DEFAULT_TRUST_ITEMS }: { items?: TrustItem[] }) {
  return (
    <div className="trust-bar">
      <div className="container trust-grid">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <div className="trust-item" key={item.title}>
              <Icon />
              <div>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
