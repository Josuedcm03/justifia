@props(['active'])

@php
$classes = ($active ?? false)
            ? 'inline-flex items-center px-1 pt-1 border-b-2 border-[#004c54] text-sm font-medium leading-5 text-gray-100 focus:outline-none focus:border-[#007e8b] transition duration-150 ease-in-out'
            : 'inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium leading-5 text-gray-300 hover:text-gray-100 hover:border-[#006b75] focus:outline-none focus:text-gray-300 focus:border-[#006b75] transition duration-150 ease-in-out';
@endphp

<a {{ $attributes->merge(['class' => $classes]) }}>
    {{ $slot }}
</a>
