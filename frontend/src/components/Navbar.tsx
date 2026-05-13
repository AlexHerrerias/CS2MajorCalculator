import React, { Fragment, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";

import { TournamentInfo } from "../types/hltvTypes";
import { TwitchUserProfile } from "../types/fantasyTypes";
import {
  getAllTournaments,
  twitchLogin,
  getCurrentUserProfile,
  logoutUser,
} from "../services/tournamentService";

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [showTournamentsDropdown, setShowTournamentsDropdown] = useState(false);
  const [currentUser, setCurrentUser] = useState<TwitchUserProfile | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const tournamentsDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getAllTournaments().then(setTournaments);
    getCurrentUserProfile().then(setCurrentUser);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tournamentsDropdownRef.current &&
        !tournamentsDropdownRef.current.contains(event.target as Node)
      ) {
        setShowTournamentsDropdown(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setShowTournamentsDropdown(false);
  };

  const handlePastTournamentsClick = () => {
    setShowTournamentsDropdown((prev) => !prev);
    setShowUserDropdown(false);
  };

  const handleUserIconClick = () => {
    if (currentUser) {
      setShowUserDropdown((prev) => !prev);
      setShowTournamentsDropdown(false);
    } else {
      twitchLogin();
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setShowUserDropdown(false);
    closeMobileMenu();
    navigate("/");
  };

  const pastTournaments = tournaments.filter((t) => !t.isLive);

  return (
    <>
      <nav className="bg-neutral-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link
                to="/"
                className="flex items-center gap-2 text-fluid-lg font-bold text-primary-400 hover:text-primary-300 transition-colors"
              >
                <img src="/weblogo.png" alt="Logo" className="h-8 sm:h-10 w-auto" />
                <span className="hidden xs:inline sm:inline">CSTracker</span>
              </Link>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/fantasy"
                className="text-neutral-300 hover:bg-neutral-700 hover:text-white px-3 py-2 rounded-md text-fluid-sm font-medium transition-colors"
              >
                Fantasy
              </Link>
            </div>

            {/* User menu + hamburger */}
            <div className="flex items-center gap-2">
              <div className="relative" ref={userDropdownRef}>
                <button
                  type="button"
                  className="flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-800 focus:ring-white"
                  id="user-menu-button"
                  aria-expanded={showUserDropdown}
                  aria-haspopup="true"
                  onClick={handleUserIconClick}
                >
                  <span className="sr-only">Abrir menú de usuario</span>
                  {currentUser && currentUser.twitch_profile_image_url ? (
                    <img
                      className="h-8 w-8 rounded-full"
                      src={currentUser.twitch_profile_image_url}
                      alt={currentUser.twitch_username || currentUser.user.username}
                    />
                  ) : currentUser ? (
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-neutral-600">
                      <span className="text-fluid-sm font-medium leading-none text-white">
                        {currentUser.user.username.substring(0, 1).toUpperCase()}
                      </span>
                    </span>
                  ) : (
                    <div className="text-neutral-300 hover:bg-neutral-700 hover:text-white px-3 py-1.5 rounded-md text-fluid-xs sm:text-fluid-sm font-medium transition-colors border border-neutral-600 hover:border-neutral-500 whitespace-nowrap">
                      Login con Twitch
                    </div>
                  )}
                </button>
                {currentUser && showUserDropdown && (
                  <div
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-neutral-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                    tabIndex={-1}
                  >
                    <div className="px-4 py-3">
                      <p className="text-fluid-xs text-white">Logueado como</p>
                      <p className="text-fluid-sm font-medium text-primary-400 truncate">
                        {currentUser.twitch_username || currentUser.user.username}
                      </p>
                    </div>
                    <Link
                      to={`/fantasy/profile/${currentUser.user.username}`}
                      className="block px-4 py-2 text-fluid-sm text-neutral-200 hover:bg-neutral-700"
                      role="menuitem"
                      onClick={() => setShowUserDropdown(false)}
                    >
                      Mi Perfil Fantasy
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-fluid-sm text-neutral-200 hover:bg-neutral-700"
                      role="menuitem"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>

              {/* Hamburger (mobile only) */}
              <div className="md:hidden">
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white transition-colors"
                  aria-controls="mobile-menu"
                  aria-expanded={isMobileMenuOpen}
                >
                  <span className="sr-only">Abrir menú principal</span>
                  <svg
                    className="h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16m-7 6h7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile slide-in panel — Headless UI gives us focus trap, ESC and click-outside */}
      <Transition show={isMobileMenuOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50 md:hidden"
          onClose={closeMobileMenu}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
          </TransitionChild>

          <div className="fixed inset-0 flex justify-end">
            <TransitionChild
              as={Fragment}
              enter="transition-transform duration-200 ease-out"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transition-transform duration-150 ease-in"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <DialogPanel
                id="mobile-menu"
                className="w-72 max-w-[85vw] bg-neutral-900 h-full shadow-xl flex flex-col"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                  <span className="text-fluid-base font-semibold text-primary-400">Menú</span>
                  <button
                    type="button"
                    onClick={closeMobileMenu}
                    className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white transition-colors"
                  >
                    <span className="sr-only">Cerrar menú</span>
                    <svg
                      className="h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                  <Link
                    to="/fantasy"
                    onClick={closeMobileMenu}
                    className="block px-3 py-2 rounded-md text-fluid-base font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors"
                  >
                    Fantasy
                  </Link>

                  {pastTournaments.length > 0 && (
                    <div className="border-t border-neutral-800 pt-2 mt-2">
                      <button
                        onClick={handlePastTournamentsClick}
                        className="w-full flex items-center justify-between text-left px-3 py-2 rounded-md text-fluid-base font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors"
                      >
                        Torneos Pasados
                        <svg
                          className={`h-4 w-4 transition-transform ${showTournamentsDropdown ? "rotate-180" : ""}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      {showTournamentsDropdown && (
                        <div className="pl-3 mt-1 space-y-1">
                          {pastTournaments.map((tournament) => (
                            <Link
                              key={tournament.slug}
                              to={`/tournament/${tournament.slug}`}
                              onClick={closeMobileMenu}
                              className="block px-3 py-2 rounded-md text-fluid-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                            >
                              {tournament.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {currentUser ? (
                    <div className="border-t border-neutral-800 pt-2 mt-2">
                      <div className="px-3 py-2">
                        <p className="text-fluid-xs text-neutral-500">Logueado como</p>
                        <p className="text-fluid-sm font-medium text-primary-400 truncate">
                          {currentUser.twitch_username || currentUser.user.username}
                        </p>
                      </div>
                      <Link
                        to={`/fantasy/profile/${currentUser.user.username}`}
                        onClick={closeMobileMenu}
                        className="block px-3 py-2 rounded-md text-fluid-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors"
                      >
                        Mi Perfil Fantasy
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-3 py-2 rounded-md text-fluid-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-neutral-800 pt-2 mt-2">
                      <button
                        onClick={() => {
                          twitchLogin();
                        }}
                        className="w-full text-left px-3 py-2 rounded-md text-fluid-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors"
                      >
                        Login con Twitch
                      </button>
                    </div>
                  )}
                </nav>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default Navbar;
