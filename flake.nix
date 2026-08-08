{
  description = "RenderFlow development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              bun
              ffmpeg
              git
            ];

            FFMPEG_PATH = "${pkgs.ffmpeg}/bin/ffmpeg";

            shellHook = ''
              echo "RenderFlow environment ready"
              echo "Bun: $(bun --version) | FFmpeg: $(ffmpeg -version | head -n 1)"
            '';
          };
        }
      );
    };
}
