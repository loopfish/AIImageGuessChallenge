import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-neutral-dark text-white py-6">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm opacity-75">&copy; {new Date().getFullYear()} Prompt Guesser. All rights reserved.</p>
          </div>
          <div className="flex space-x-4">
            <Link href="#" className="text-white hover:text-accent transition-colors duration-200">
              Terms
            </Link>
            <Link href="#" className="text-white hover:text-accent transition-colors duration-200">
              Privacy
            </Link>
            <Link href="#" className="text-white hover:text-accent transition-colors duration-200">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
