import Image from "next/image";
import { Upload } from "lucide-react";

export default function ProfileUploader({ logoSrc, schoolName }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-2 shadow-sm">
        <Image
          src={logoSrc}
          alt={`${schoolName} logo`}
          width={72}
          height={72}
          className="h-full w-full rounded-xl object-cover"
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">School Logo</p>
        <p className="mt-1 text-xs text-slate-400">
          PNG or JPG, recommended square image up to 2 MB.
        </p>
        <button
          type="button"
          className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Upload size={13} />
          Upload Logo
        </button>
      </div>
    </div>
  );
}
