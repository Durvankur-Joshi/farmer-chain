import React from "react";

export default function ProvenanceCard({ allocations = [], provenanceSummary, fpoName }) {
  if (!allocations || allocations.length === 0) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs text-slate-500 font-medium">
        <span className="font-semibold">🏢 FPO Stock Lot</span> {fpoName ? `(${fpoName})` : ""} — Direct inventory lot.
      </div>
    );
  }

  const farmersCount = provenanceSummary?.total_farmers_count || new Set(allocations.map((a) => a.farmer_name || a.farmer?.name)).size;
  const passportsCount = provenanceSummary?.total_passports_count || allocations.filter((a) => a.crop_passport_id || a.crop_passport || a.crop_passport_details).length;

  return (
    <div className="p-3 sm:p-3.5 bg-purple-50/70 border border-purple-200/90 rounded-2xl space-y-2 text-xs min-w-0">
      <div className="flex items-center justify-between text-purple-950 font-extrabold text-[11px] flex-wrap gap-1.5">
        <div className="flex items-center gap-1.5">
          <span>🔗</span>
          <span>Verified Supply Chain Provenance:</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {farmersCount} Farmer{farmersCount !== 1 ? "s" : ""}
          </span>
          <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {passportsCount} Passport{passportsCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {allocations.map((alloc, idx) => {
          const farmerName = alloc.farmer_name || alloc.farmer?.name || "Verified Farmer";
          const farmerDid = alloc.farmer_did || alloc.farmer?.did || "";
          const farmerLocation = alloc.farmer_location || (alloc.farmer ? `${alloc.farmer.city}, ${alloc.farmer.state}` : "");
          const passportId = alloc.crop_passport_id || alloc.crop_passport?.id || alloc.crop_passport_details?.id;
          const cpDetails = alloc.crop_passport_details || (typeof alloc.crop_passport === 'object' ? alloc.crop_passport : null);
          const aiGrade = cpDetails?.ai_verification?.quality_grade || cpDetails?.ai_grade;
          const isMinted = cpDetails?.is_minted;
          const nftTokenId = cpDetails?.nft_token_id;
          const qty = alloc.allocated_quantity || alloc.quantity;
          const unit = alloc.unit || "unit";

          return (
            <div
              key={alloc.id || idx}
              className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-2xs space-y-1.5 hover:border-purple-300 transition-all min-w-0"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-slate-900 text-xs truncate">👨‍🌾 {farmerName}</p>
                  {farmerLocation && (
                    <p className="text-[10px] text-slate-500 font-medium truncate">📍 {farmerLocation}</p>
                  )}
                  {farmerDid && (
                    <p className="text-[9px] font-mono text-slate-400 truncate">DID: {farmerDid.slice(0, 18)}…</p>
                  )}
                </div>
                <span className="font-mono font-extrabold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-lg text-xs shrink-0">
                  {qty} {unit}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] flex-wrap gap-1">
                {passportId ? (
                  <a
                    href={`/crop-passport/${passportId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 transition-all text-[10px]"
                  >
                    <span>📜</span>
                    <span>View Passport #{passportId} 🔗</span>
                  </a>
                ) : (
                  <span className="text-slate-400 italic">No Passport</span>
                )}

                {aiGrade && (
                  <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
                    Grade {aiGrade}
                  </span>
                )}

                {isMinted && (
                  <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                    NFT #{nftTokenId || passportId}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
