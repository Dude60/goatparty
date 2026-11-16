import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#121314] text-white p-4">
      <h2 className="text-xl font-bold mb-2">Page Not Found</h2>
      <p className="text-zinc-400 text-sm mb-4">Could not find requested resource.</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition"
      >
        Return Home
      </Link>
    </div>
  );
}
