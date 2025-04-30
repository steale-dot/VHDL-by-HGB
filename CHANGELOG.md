# Changelog

## [1.0.2] - 2025-04-30
- Entity-Converter:
    - instantiations:
        - component
        - entity
    - copy:
        - port-lists
        - generic-lists
- Extension-Settings:
    - `vhdl-by-hgb.vhdlls.toml.auto.exclude`:
        - exclude certain file-extensions from an auto-generated vhdl_ls.toml. file-extensions to be excluded can be specified via a configuration-property. default-values are the file-extensions for verilog and systemverilog.
    - `vhdl-by-hgb.vhdlls.standardLibraries`:
        - By default, VHDL standard libraries (ieee, std, ...) are located in pre-defined standard paths. This setting allows you to specify a custom path for these libraries. If this setting is omitted, the language server will search in the pre-defined standard paths for these libraries.
- VHDL_LS:        
    - documentation:
        - vhdl_ls.toml: exclude files
        - vhdl_ls: off/on -> ignore code

## [1.0.1] - 2024-06-28
- VHDL_LS: 
    - macOS-support
    - extension-setting: "nonProjectFiles" -> Defines how the server handles files that are not part of the vhdl_ls.toml configuration file
    - vhdls_ls.toml:
        - setting: VHDL-standard
        - setting: Lint
        - info: paths -> glob-patterns and environment variables
- Entity-Converter -> PasteSignals (bug-fix)
- VHDL-snippets -> updated

## [1.0.0] - 2024-01-11
- First Release