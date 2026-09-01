/**
 * De lo que devuelve un geocodificador a los campos del formulario.
 *
 * POR QUÉ HACE FALTA TRADUCIR
 *
 * Nominatim —y cualquier otro— devuelve la jerarquía administrativa completa de
 * OpenStreetMap: `state`, `county`, `city`, `suburb`, `neighbourhood`, `road`,
 * `house_number` y unas cuantas más. El formulario del checkout tiene tres
 * campos: dirección, ciudad y provincia. Nadie más que esta función debería
 * saber cómo se pasa de lo uno a lo otro.
 *
 * LA JERARQUÍA PANAMEÑA NO ES LA DE OSM
 *
 * En Panamá el orden real es provincia → distrito → corregimiento. En OSM eso
 * cae, casi siempre, en `state` → `county` → `city`/`town`/`village`. Pero no
 * siempre: en Ciudad de Panamá el corregimiento aparece unas veces como `city`
 * y otras como `suburb`, y en zonas rurales el distrito puede faltar. Por eso
 * cada campo se resuelve con una lista de candidatos en orden de preferencia y
 * no con una sola clave.
 *
 * ES PURA A PROPÓSITO
 *
 * La decisión de qué texto acaba en «Ciudad» es la que más se va a corregir
 * cuando lleguen direcciones reales, y tiene que poder corregirse contra una
 * batería de ejemplos guardados, sin red y sin mapa.
 */

/** La parte de una respuesta de geocodificación que sí nos interesa. */
export interface PartesDeDireccion {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  residential?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  city_district?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  municipality?: string;
  state?: string;
  region?: string;
  postcode?: string;
  country_code?: string;
}

/** Una dirección ya repartida en los campos que el formulario tiene. */
export interface DireccionAproximada {
  /** Calle y número, o lo más parecido que haya. */
  line1: string;
  /** Corregimiento o distrito: lo que en Panamá se escribe como «ciudad». */
  city: string;
  /** Provincia, sin el «Provincia de» delante. */
  province: string;
  /** El texto completo tal cual, para enseñarlo como confirmación. */
  etiqueta: string;
}

/** Las nueve provincias más las tres comarcas, escritas como se escriben. */
const PROVINCIAS = [
  'Bocas del Toro',
  'Coclé',
  'Colón',
  'Chiriquí',
  'Darién',
  'Herrera',
  'Los Santos',
  'Panamá',
  'Panamá Oeste',
  'Veraguas',
  'Emberá-Wounaan',
  'Guna Yala',
  'Ngäbe-Buglé',
] as const;

function primeroConTexto(...candidatos: (string | undefined)[]): string {
  for (const candidato of candidatos) {
    const limpio = candidato?.trim();
    if (limpio) return limpio;
  }
  return '';
}

/**
 * Quita los prefijos administrativos que OSM arrastra y el formulario no quiere.
 *
 * «Distrito de Panamá» y «Provincia de Panamá» son correctos en un mapa y
 * ruidosos en una etiqueta de envío: quien la lee quiere leer «Panamá».
 */
function sinPrefijoAdministrativo(valor: string): string {
  return valor
    .replace(/^(provincia|distrito|corregimiento|comarca|municipio)\s+de\s+/i, '')
    .replace(/^(provincia|distrito|corregimiento|comarca|municipio)\s+/i, '')
    .trim();
}

/**
 * Normaliza la provincia contra la lista real del país.
 *
 * Si lo que llega se parece a una provincia conocida se devuelve escrita como
 * toca —con sus tildes— y si no, se devuelve tal cual: una comarca nueva o un
 * cambio administrativo no debe vaciar el campo.
 */
export function normalizarProvincia(valor: string): string {
  const limpio = sinPrefijoAdministrativo(valor);
  if (!limpio) return '';

  const plano = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  return PROVINCIAS.find((provincia) => plano(provincia) === plano(limpio)) ?? limpio;
}

/**
 * Reparte una dirección geocodificada en los tres campos del formulario.
 *
 * Lo que no se pueda resolver se devuelve vacío, nunca inventado: un campo en
 * blanco lo rellena quien compra en dos segundos, y una calle equivocada la
 * descubre el motorizado en la puerta de otra casa.
 */
export function repartirDireccion(
  partes: PartesDeDireccion | undefined,
  etiqueta: string,
): DireccionAproximada {
  const p = partes ?? {};

  const via = primeroConTexto(p.road, p.pedestrian, p.residential);
  const barrio = primeroConTexto(p.neighbourhood, p.quarter, p.suburb, p.city_district);

  // La calle con su número si lo hay; si no hay calle, el barrio hace de
  // dirección, que es exactamente lo que escribiría a mano quien vive ahí.
  const line1 = via
    ? [via, p.house_number?.trim()].filter(Boolean).join(' ')
    : primeroConTexto(barrio);

  // Si el barrio ya se gastó como dirección no se repite en «ciudad»: dos veces
  // el mismo texto en la etiqueta de envío parece un error de la tienda.
  const ciudadCruda = primeroConTexto(
    p.city,
    p.town,
    p.village,
    via ? barrio : undefined,
    p.county,
    p.municipality,
  );

  return {
    line1,
    city: sinPrefijoAdministrativo(ciudadCruda),
    province: normalizarProvincia(primeroConTexto(p.state, p.region)),
    etiqueta: etiqueta.trim(),
  };
}

/** ¿Trae algo que merezca la pena volcar en el formulario? */
export function tieneAlgoQueRellenar(direccion: DireccionAproximada): boolean {
  return Boolean(direccion.line1 || direccion.city || direccion.province);
}
