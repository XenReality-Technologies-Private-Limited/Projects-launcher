import { useEffect, useState } from "react";

interface Store {
  storeCode: string;
  location: string;
  statusPageSlug: string;
}

export default function DeviceStatusPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState("");
  const [selectedStore, setSelectedStore] = useState("");

  useEffect(() => {
    loadStores();
  }, []);

  async function loadStores() {
    try {
      const res = await fetch("/devicesOnline.json");
      const data = await res.json();
      setStores(data.stores || []);
    } catch (err) {
      console.error(err);
    }
  }

  function openStatusModal(url: string, storeName: string) {
    setSelectedUrl(url);
    setSelectedStore(storeName);
    setModalOpen(true);
    document.body.style.overflow = "hidden";
  }

  function closeStatusModal() {
    setModalOpen(false);
    setSelectedUrl("");
    document.body.style.overflow = "";
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">
            Devices
          </h2>

          <span className="text-sm font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-500">
            {stores.length} {stores.length === 1 ? "store" : "stores"}
          </span>
        </div>

        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-[2px] text-slate-400 w-48">
                Store Code
              </th>

              <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-[2px] text-slate-400">
                Location
              </th>

              <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-[2px] text-slate-400 w-48">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {stores.map((store) => {
              const statusUrl =
                `https://status.xenreality.com/status/${store.statusPageSlug}`;

              return (
                <tr
                  key={store.storeCode}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-5 text-base font-semibold text-slate-800">
                    {store.storeCode}
                  </td>

                  <td className="px-6 py-5 text-base text-slate-600">
                    {store.location}
                  </td>

                  <td className="px-6 py-5 text-right">
                    <button
                      onClick={() =>
                        openStatusModal(
                          statusUrl,
                          `Store ${store.storeCode}`
                        )
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:border-[#2E3192] hover:text-[#2E3192] transition-all whitespace-nowrap"
                    >
                      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0">
                        <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 2h5m0 0v5m0-5L7 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      View Status
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

          <div className="bg-white rounded-2xl w-full max-w-7xl h-[95vh] overflow-hidden shadow-2xl">

            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">
                {selectedStore}
              </h2>

              <button
                onClick={closeStatusModal}
                className="text-2xl text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <iframe
              src={selectedUrl}
              title={selectedStore}
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </>
  );
}