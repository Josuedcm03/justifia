<nav x-data="{ open: false }" class="bg-[#0095a4] border-b border-[#007e8b]">
    <!-- Primary Navigation Menu -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
            <div class="flex">
                <!-- Logo -->
                <div class="shrink-0 flex items-center">
                    <a href="{{ route('dashboard') }}">
                        <x-application-logo class="block h-9 w-auto fill-current text-gray-800 dark:text-gray-200" />
                    </a>
                </div>

                <!-- Navigation Links -->
                <div class="hidden space-x-8 sm:-my-px sm:ms-10 sm:flex">
                    @if(auth()->check() && auth()->user()->hasRole('estudiante'))
                        <x-nav-link :href="route('estudiante.solicitudes.index')" :active="request()->routeIs('estudiante.solicitudes.*')">
                            {{ __('Ver Solicitudes') }}
                        </x-nav-link>
                        <x-nav-link :href="route('estudiante.apelaciones.index')" :active="request()->routeIs('estudiante.apelaciones.*')">
                            {{ __('Ver Apelaciones') }}
                        </x-nav-link>
                    @endif
                    @if(auth()->check() && auth()->user()->hasRole('secretaria'))
                    <x-nav-link :href="route('dashboard')" :active="request()->routeIs('dashboard')">
                            {{ __('Dashboard') }}
                        </x-nav-link>
                        <x-nav-link :href="route('secretaria.solicitudes.index')" :active="request()->routeIs('secretaria.solicitudes.*')">
                            {{ __('Gestionar Solicitudes') }}
                        </x-nav-link>
                        <x-nav-link :href="route('secretaria.apelaciones.index')" :active="request()->routeIs('secretaria.apelaciones.*')">
                            {{ __('Gestionar Apelaciones') }}
                        </x-nav-link>
                        <x-nav-link :href="route('secretaria.catalogos.index')" :active="request()->routeIs('secretaria.catalogos.*', 'secretaria.facultades.*', 'secretaria.carreras.*', 'secretaria.docentes.*', 'secretaria.asignaturas.*', 'secretaria.tipo-constancia.*')">
                            {{ __('Gestionar Catálogos') }}
                        </x-nav-link>
                    @endif
                    @if(auth()->check() && auth()->user()->hasRole('docente'))
                        <x-nav-link :href="route('docente.solicitudes.index')" :active="request()->routeIs('docente.solicitudes.*')">
                            {{ __('Reprogramaciones') }}
                        </x-nav-link>
                    @endif
                </div> 
            </div>

            <!-- Settings Dropdown -->
            <div class="hidden sm:flex sm:items-center sm:ms-6">
                <x-dropdown align="right" width="48">
                    <x-slot name="trigger">
                        <button class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-300 hover:text-gray-100 focus:outline-none transition ease-in-out duration-150">
                        @if(Auth::check())    
                        <div>{{ Auth::user()->name }}</div>
                        @endif

                            <div class="ms-1">
                                <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </div>
                        </button>
                    </x-slot>

                    <x-slot name="content">
                        <x-dropdown-link :href="route('profile.edit')">
                            {{ __('Perfil') }}
                        </x-dropdown-link>

                        <!-- Authentication -->
                        <form method="POST" action="{{ route('logout') }}">
                            @csrf

                            <x-dropdown-link :href="route('logout')"
                                    onclick="event.preventDefault();
                                                this.closest('form').submit();">
                                {{ __('Cerrar Sesión') }}
                            </x-dropdown-link>
                        </form>
                    </x-slot>
                </x-dropdown>
                    <button @click="$store.theme.toggle()" class="ms-4 text-gray-300 hover:text-gray-200 focus:outline-none">
                    <x-heroicon-o-sun x-show="!$store.theme.dark" class="w-6 h-6" x-cloak />
                    <x-heroicon-o-moon x-show="$store.theme.dark" class="w-6 h-6" x-cloak />
                </button>
            </div>

            <!-- Hamburger -->
            <div class="-me-2 flex items-center sm:hidden">
                <button @click="open = ! open" class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-900 focus:text-gray-500 dark:focus:text-gray-400 transition duration-150 ease-in-out">
                    <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                        <path :class="{'hidden': open, 'inline-flex': ! open }" class="inline-flex" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        <path :class="{'hidden': ! open, 'inline-flex': open }" class="hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    </div>

    <!-- Responsive Navigation Menu -->
    <div :class="{'block': open, 'hidden': ! open}" class="hidden sm:hidden">
        <div class="pt-2 pb-3 space-y-1 ">
            <x-responsive-nav-link :href="route('dashboard')" :active="request()->routeIs('dashboard')">
                {{ __('Dashboard') }}
            </x-responsive-nav-link>
            @if(auth()->check() && auth()->user()->hasRole('estudiante'))
            <x-responsive-nav-link :href="route('estudiante.solicitudes.index')" :active="request()->routeIs('estudiante.solicitudes.*')">
                {{ __('Ver Solicitudes') }}
            </x-responsive-nav-link>
            <x-responsive-nav-link :href="route('estudiante.apelaciones.index')" :active="request()->routeIs('estudiante.apelaciones.*')">
                {{ __('Ver Apelaciones') }}
            </x-responsive-nav-link>
            @endif
            @if(auth()->check() && auth()->user()->hasRole('secretaria'))
            <x-responsive-nav-link :href="route('dashboard')" :active="request()->routeIs('dashboard')">
                {{ __('Dashboard') }}
            </x-responsive-nav-link>
            <x-responsive-nav-link :href="route('secretaria.solicitudes.index')" :active="request()->routeIs('secretaria.solicitudes.*')">
                {{ __('Gestionar Solicitudes') }}
            </x-responsive-nav-link>
            <x-responsive-nav-link :href="route('secretaria.apelaciones.index')" :active="request()->routeIs('secretaria.apelaciones.*')">
                {{ __('Gestionar Apelaciones') }}
            </x-responsive-nav-link>
            <x-responsive-nav-link :href="route('secretaria.catalogos.index')" :active="request()->routeIs('secretaria.catalogos.*', 'secretaria.facultades.*', 'secretaria.carreras.*', 'secretaria.docentes.*', 'secretaria.asignaturas.*', 'secretaria.tipo-constancia.*')">
                {{ __('Gestionar Catálogos') }}
            </x-responsive-nav-link>
            @endif
            @if(auth()->check() && auth()->user()->hasRole('docente'))
            <x-responsive-nav-link :href="route('docente.solicitudes.index')" :active="request()->routeIs('docente.solicitudes.*')">
                {{ __('Reprogramaciones') }}
            </x-responsive-nav-link>
            @endif
        </div>

        <!-- Responsive Settings Options -->
        <div class="pt-4 pb-1 border-t border-gray-200 dark:border-gray-600">
            <div class="px-4">
                @if(Auth::check())
                <div class="font-medium text-base text-gray-800 dark:text-gray-200">{{ Auth::user()->name }}</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">{{ Auth::user()->email }}</div>
                @endif
            </div>

            <div class="mt-3 space-y-1">
                <x-responsive-nav-link :href="route('profile.edit')">
                    {{ __('Perfil') }}
                </x-responsive-nav-link>

                <!-- Authentication -->
                <form method="POST" action="{{ route('logout') }}">
                    @csrf

                    <x-responsive-nav-link :href="route('logout')"
                            onclick="event.preventDefault();
                                        this.closest('form').submit();">
                        {{ __('Cerrar Sesión') }}
                    </x-responsive-nav-link>
                </form>
                    <button @click="$store.theme.toggle()" class="block w-full ps-3 pe-4 py-2 border-l-4 border-transparent text-start text-base font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:text-gray-800 dark:focus:text-gray-200 focus:bg-gray-50 dark:focus:bg-gray-700 focus:border-gray-300 dark:focus:border-gray-600 transition duration-150 ease-in-out">
                    <div class="flex items-center">
                        <x-heroicon-o-sun x-show="!$store.theme.dark" class="w-5 h-5 mr-2" x-cloak />
                        <x-heroicon-o-moon x-show="$store.theme.dark" class="w-5 h-5 mr-2" x-cloak />
                        <span>Cambiar tema</span>
                    </div>
                </button>
            </div>
        </div>
    </div>
</nav>
