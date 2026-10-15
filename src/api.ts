export async function api(path: string, data?: unknown) {
  const response = await fetch('/api'+path,{ method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}) });
  const result = await response.json();
  if(!response.ok) throw new Error(result.error || 'SERVICE_UNAVAILABLE');
  return result;
}
export const errorText = (error: unknown) => {
 const code=error instanceof Error?error.message:'';
 const messages:Record<string,string>={PACKAGE_CHANGED:'Oferta zmieniła się podczas składania zamówienia. Odśwież stronę i sprawdź cenę.',FULL:'Ten dzień właśnie się zapełnił. Wybierz inny dostępny termin — Twoje dane pozostają w formularzu.',NOT_READY:'Zamówienia online nie są jeszcze uruchomione.',UNAUTHORIZED:'Zaloguj się kontem administratora. Sesja mogła wygasnąć.',DOCUMENTS_CHANGED:'Warunki zostały zaktualizowane. Odśwież stronę i zapoznaj się z aktualną wersją przed zamówieniem.',IDEMPOTENCY_CONFLICT:'Poprzednia próba zawierała inne dane. Sprawdź jej wynik przed rozpoczęciem nowego zamówienia.',RATE_LIMIT:'Zbyt wiele prób. Spróbuj ponownie za 15 minut.',CAPACITY_BELOW_OCCUPANCY:'Ten limit jest niższy od istniejącego obłożenia. Zamówienia pozostają bez zmian.',TERMINAL_STATUS:'To zamówienie ma status końcowy.',INVALID_TRANSITION:'Ta zmiana statusu nie jest dozwolona.',NOT_ACCEPTED:'Najpierw przyjmij zamówienie.',REASON_REQUIRED:'Podaj powód zmiany dla klienta.'};
 return messages[code] || 'Nie udało się wykonać operacji. Twoje dane pozostają w formularzu. Sprawdź połączenie i spróbuj ponownie.';
};
